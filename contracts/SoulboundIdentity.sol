// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC5484.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/*//////////////////////////////////////////////////////////////
                    EXTERNAL CONTRACT INTERFACES
//////////////////////////////////////////////////////////////*/

/// @notice Interface for CredentialsHub — only the functions SoulboundIdentity calls
interface ICredentialsHub {
    /// @notice Grant (or revoke) credential-type access for a viewer.
    ///         Called by SoulboundIdentity during batch approve/revoke.
    /// @param tokenId   The soulbound token ID
    /// @param viewer    The address receiving or losing access
    /// @param types     Bitmask of credential types (0 = revoke all)
    function grantCredentialAccess(
        uint256 tokenId,
        address viewer,
        uint8 types
    ) external;
}

/// @notice Interface for SocialHub — only the functions SoulboundIdentity calls
interface ISocialHub {
    /// @notice Grant (or revoke) social-section access for a viewer.
    ///         Called by SoulboundIdentity during batch approve/revoke.
    /// @param tokenId   The soulbound token ID
    /// @param viewer    The address receiving or losing access
    /// @param sections  Bitmask of social sections (0 = revoke all)
    function grantSocialAccess(
        uint256 tokenId,
        address viewer,
        uint8 sections
    ) external;
}

/**
 * @title SoulboundIdentity V3.0
 * @notice Soulbound identity tokens with privacy-controlled metadata access.
 * @dev Extends ERC5484 with IPFS metadata, access control, and single-tx
 *      batch approval/revocation across all three identity contracts.
 *
 * CHANGES FROM V2.2:
 * ✅ approveAccessWithPermissions  — approve profile + credentials + social in ONE tx
 * ✅ revokeAccessWithPermissions   — revoke all three in ONE tx (clears cred+social grants)
 * ✅ getGrantedAddresses           — on-chain list of grantees (replaces localStorage)
 * ✅ getMetadata                   — alias for tokenURI (matches frontend ABI)
 * ✅ totalSupply                   — exposes token counter (fixes hardcoded max-10 scan)
 * ✅ setCredentialsHub / setSocialHub — owner registers sibling contracts
 */
contract SoulboundIdentity is ERC5484, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /*//////////////////////////////////////////////////////////////
                            CUSTOM ERRORS
    //////////////////////////////////////////////////////////////*/

    error OnlyTokenOwner();
    error OwnerHasAccess();
    error InvalidAddress();
    error NoAccessRequest();
    error RequestAlreadyExists();
    error EmptyIPFSCID();
    error InvalidIPFSCID();
    error InvalidDuration();
    error DurationOverflow();
    error TooManyRequests();
    error RequestCooldown(uint256 timeRemaining);
    error AlreadyHasToken();
    /// @notice Thrown when a batch-approve is attempted before sibling contracts are set
    error HubsNotConfigured();

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant REQUEST_COOLDOWN = 1 hours;
    uint256 public constant MAX_REQUESTS_PER_DAY = 10;

    /*//////////////////////////////////////////////////////////////
                        SIBLING CONTRACT REFERENCES
    //////////////////////////////////////////////////////////////*/

    /// @notice CredentialsHub contract — set once by owner after deployment
    ICredentialsHub public credentialsHub;

    /// @notice SocialHub contract — set once by owner after deployment
    ISocialHub public socialHub;

    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/

    uint256 private _tokenIdCounter;

    mapping(uint256 => string) private _metadataCID;

    // Rate limiting
    mapping(address => mapping(uint256 => uint256)) private _lastRequestTime;
    mapping(address => uint256) private _requestCount;
    mapping(address => uint256) private _lastResetDay;

    // Pending requesters (EnumerableSet for O(1) add/remove/contains)
    mapping(uint256 => EnumerableSet.AddressSet) private _pendingRequesters;

    // On-chain grantee tracking — replaces unreliable localStorage
    mapping(uint256 => EnumerableSet.AddressSet) private _grantedAddresses;

    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    enum AccessStatus {
        None,
        Pending,
        Approved,
        Denied
    }

    struct AccessRequest {
        AccessStatus status;
        uint64 expiresAt;
    }

    mapping(uint256 => mapping(address => AccessRequest)) private _access;

    /*//////////////////////////////////////////////////////////////
                        EVENTS
    //////////////////////////////////////////////////////////////*/

    event AccessRequested(uint256 indexed tokenId, address indexed requester);
    event AccessApproved(
        uint256 indexed tokenId,
        address indexed requester,
        uint64 expiresAt
    );
    event AccessDenied(uint256 indexed tokenId, address indexed requester);
    event AccessRevoked(
        uint256 indexed tokenId,
        address indexed requester,
        string reason
    );
    event AccessExpired(uint256 indexed tokenId, address indexed requester);
    event ExpiredAccessCleaned(uint256 indexed tokenId, uint256 count);
    event CredentialsHubSet(address indexed hub);
    event SocialHubSet(address indexed hub);

    /*//////////////////////////////////////////////////////////////
                        MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyTokenOwner(uint256 tokenId) {
        if (msg.sender != ownerOf(tokenId)) revert OnlyTokenOwner();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() ERC5484("Soulbound Identity", "SBTID") Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                    SIBLING CONTRACT REGISTRATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Register the CredentialsHub contract address.
    ///         Call once after all three contracts are deployed.
    /// @param hub Address of the deployed CredentialsHub contract
    function setCredentialsHub(address hub) external onlyOwner {
        if (hub == address(0)) revert InvalidAddress();
        credentialsHub = ICredentialsHub(hub);
        emit CredentialsHubSet(hub);
    }

    /// @notice Register the SocialHub contract address.
    ///         Call once after all three contracts are deployed.
    /// @param hub Address of the deployed SocialHub contract
    function setSocialHub(address hub) external onlyOwner {
        if (hub == address(0)) revert InvalidAddress();
        socialHub = ISocialHub(hub);
        emit SocialHubSet(hub);
    }

    /*//////////////////////////////////////////////////////////////
                        PAUSABLE CONTROLS
    //////////////////////////////////////////////////////////////*/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function isPaused() external view returns (bool) {
        return paused();
    }

    /*//////////////////////////////////////////////////////////////
                              MINT
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint a new soulbound identity token (one per address)
    function mint(
        string calldata ipfsCID,
        BurnAuth burnAuth
    ) external returns (uint256) {
        if (balanceOf(msg.sender) > 0) revert AlreadyHasToken();
        return _mint(msg.sender, ipfsCID, burnAuth);
    }

    function _mint(
        address to,
        string calldata ipfsCID,
        BurnAuth burnAuth
    ) internal returns (uint256) {
        if (bytes(ipfsCID).length == 0) revert EmptyIPFSCID();
        if (!_isValidCID(ipfsCID)) revert InvalidIPFSCID();

        uint256 tokenId;
        unchecked {
            tokenId = ++_tokenIdCounter;
        }

        _mintSBT(to, tokenId, burnAuth);
        _metadataCID[tokenId] = ipfsCID;
        return tokenId;
    }

    /*//////////////////////////////////////////////////////////////
                              BURN
    //////////////////////////////////////////////////////////////*/

    function burn(uint256 tokenId) external {
        _burnSBT(tokenId);
        delete _metadataCID[tokenId];

        // Clean up pending requesters
        EnumerableSet.AddressSet storage pending = _pendingRequesters[tokenId];
        uint256 length = pending.length();
        for (uint256 i = length; i > 0; ) {
            unchecked { --i; }
            pending.remove(pending.at(i));
        }

        // Clean up granted addresses
        EnumerableSet.AddressSet storage granted = _grantedAddresses[tokenId];
        uint256 gLength = granted.length();
        for (uint256 i = gLength; i > 0; ) {
            unchecked { --i; }
            granted.remove(granted.at(i));
        }
    }

    /*//////////////////////////////////////////////////////////////
                      SINGLE-STEP ACCESS REQUESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Request access to a token's metadata
    function requestAccess(uint256 tokenId) external {
        if (msg.sender == ownerOf(tokenId)) revert OwnerHasAccess();

        uint256 lastRequest = _lastRequestTime[msg.sender][tokenId];
        if (block.timestamp < lastRequest + REQUEST_COOLDOWN) {
            revert RequestCooldown(
                (lastRequest + REQUEST_COOLDOWN) - block.timestamp
            );
        }

        _checkAndUpdateRateLimit(msg.sender);

        AccessRequest storage request = _access[tokenId][msg.sender];

        if (
            request.status == AccessStatus.Approved &&
            block.timestamp >= request.expiresAt
        ) {
            emit AccessExpired(tokenId, msg.sender);
            request.status = AccessStatus.None;
        }

        if (request.status == AccessStatus.Pending) revert RequestAlreadyExists();

        request.status = AccessStatus.Pending;
        _lastRequestTime[msg.sender][tokenId] = block.timestamp;
        _pendingRequesters[tokenId].add(msg.sender);

        emit AccessRequested(tokenId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
               APPROVE — SINGLE-CONTRACT (profile only)
    //////////////////////////////////////////////////////////////*/

    /// @notice Approve an access request for profile metadata only.
    ///         Use approveAccessWithPermissions for the full one-tx flow.
    function approveAccess(
        uint256 tokenId,
        address requester,
        uint64 duration
    ) external onlyTokenOwner(tokenId) {
        _doApprove(tokenId, requester, duration);
    }

    /*//////////////////////////////////////////////////////////////
         APPROVE — BATCH (profile + credentials + social, ONE TX)
    //////////////////////////////////////////////////////////////*/

    /// @notice Approve access and set credential + social permissions in a
    ///         single transaction. Replaces the previous three-tx flow.
    ///
    /// @param tokenId       Token whose access is being granted
    /// @param requester     Address that requested access
    /// @param duration      Access duration in seconds (e.g. 30 days = 2592000)
    /// @param credTypes     Bitmask of credential types to share
    ///                      bit0=Degree, bit1=Cert, bit2=WorkExp,
    ///                      bit3=IdentityProof, bit4=Skills
    ///                      Pass 0b11111 (31) to share all five types.
    /// @param socialSections Bitmask of social sections to share
    ///                      bit0=Reviews, bit1=Projects, bit2=Endorsements
    ///                      Pass 0b111 (7) to share all three sections.
    function approveAccessWithPermissions(
        uint256 tokenId,
        address requester,
        uint64 duration,
        uint8 credTypes,
        uint8 socialSections
    ) external onlyTokenOwner(tokenId) {
        if (address(credentialsHub) == address(0) || address(socialHub) == address(0)) {
            revert HubsNotConfigured();
        }

        _doApprove(tokenId, requester, duration);
        credentialsHub.grantCredentialAccess(tokenId, requester, credTypes);
        socialHub.grantSocialAccess(tokenId, requester, socialSections);
    }

    /*//////////////////////////////////////////////////////////////
                      DENY / REVOKE
    //////////////////////////////////////////////////////////////*/

    /// @notice Deny a pending access request
    function denyAccess(
        uint256 tokenId,
        address requester
    ) external onlyTokenOwner(tokenId) {
        if (requester == address(0)) revert InvalidAddress();

        AccessRequest storage request = _access[tokenId][requester];
        if (request.status != AccessStatus.Pending) revert NoAccessRequest();

        request.status = AccessStatus.Denied;
        _pendingRequesters[tokenId].remove(requester);

        emit AccessDenied(tokenId, requester);
    }

    /// @notice Revoke approved access (profile only).
    ///         Use revokeAccessWithPermissions to also clear cred+social grants.
    function revokeAccess(
        uint256 tokenId,
        address requester,
        string calldata reason
    ) external onlyTokenOwner(tokenId) {
        _doRevoke(tokenId, requester, reason);
    }

    /// @notice Revoke access AND clear credential + social grants in ONE tx.
    ///         Ensures the viewer cannot access any data after revocation.
    function revokeAccessWithPermissions(
        uint256 tokenId,
        address requester,
        string calldata reason
    ) external onlyTokenOwner(tokenId) {
        if (address(credentialsHub) == address(0) || address(socialHub) == address(0)) {
            revert HubsNotConfigured();
        }

        _doRevoke(tokenId, requester, reason);
        credentialsHub.grantCredentialAccess(tokenId, requester, 0);
        socialHub.grantSocialAccess(tokenId, requester, 0);
    }

    /// @notice Clean expired access entries manually
    function cleanExpiredAccess(
        uint256 tokenId,
        address[] calldata addresses
    ) external returns (uint256 count) {
        for (uint256 i = 0; i < addresses.length; ) {
            AccessRequest storage request = _access[tokenId][addresses[i]];
            if (
                request.status == AccessStatus.Approved &&
                block.timestamp >= request.expiresAt
            ) {
                _grantedAddresses[tokenId].remove(addresses[i]);
                delete _access[tokenId][addresses[i]];
                emit AccessExpired(tokenId, addresses[i]);
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }

        if (count > 0) emit ExpiredAccessCleaned(tokenId, count);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the total number of tokens ever minted (= highest token ID)
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @notice Get token's IPFS metadata CID.
    ///         Alias kept for frontend compatibility.
    function getMetadata(uint256 tokenId) external view returns (string memory) {
        return _metadataCID[tokenId];
    }

    /// @inheritdoc ERC5484
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return _metadataCID[tokenId];
    }

    /// @notice Returns all addresses that have ever been granted access to a
    ///         token and have not yet had that access revoked on-chain.
    ///         Replaces the unreliable localStorage workaround in the frontend.
    /// @param tokenId The token ID to query
    /// @return Array of addresses with currently granted (possibly expired) access
    function getGrantedAddresses(
        uint256 tokenId
    ) external view returns (address[] memory) {
        EnumerableSet.AddressSet storage set = _grantedAddresses[tokenId];
        uint256 len = set.length();
        address[] memory result = new address[](len);
        for (uint256 i = 0; i < len; ) {
            result[i] = set.at(i);
            unchecked { ++i; }
        }
        return result;
    }

    function canView(
        uint256 tokenId,
        address viewer
    ) external view returns (bool) {
        if (viewer == ownerOf(tokenId)) return true;
        AccessRequest storage request = _access[tokenId][viewer];
        return request.status == AccessStatus.Approved &&
               block.timestamp < request.expiresAt;
    }

    function checkAccess(
        uint256 tokenId,
        address requester
    ) external view returns (bool hasAccess, uint64 expiresAt) {
        if (requester == ownerOf(tokenId)) return (true, type(uint64).max);
        AccessRequest storage request = _access[tokenId][requester];
        if (request.status == AccessStatus.Approved &&
            block.timestamp < request.expiresAt) {
            return (true, request.expiresAt);
        }
        return (false, 0);
    }

    function getAccessStatus(
        uint256 tokenId,
        address requester
    ) external view returns (AccessStatus status) {
        return _access[tokenId][requester].status;
    }

    function getPendingRequests(
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory requesters, uint256 totalCount) {
        EnumerableSet.AddressSet storage pending = _pendingRequesters[tokenId];
        totalCount = pending.length();

        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        if (offset >= totalCount) return (new address[](0), totalCount);

        uint256 count = end - offset;
        requesters = new address[](count);
        for (uint256 i = 0; i < count; ) {
            requesters[i] = pending.at(offset + i);
            unchecked { ++i; }
        }
    }

    function tokensOfOwner(
        address owner
    ) external view returns (uint256[] memory tokenIds) {
        uint256 balance = balanceOf(owner);
        tokenIds = new uint256[](balance);
        for (uint256 i = 0; i < balance; ) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
            unchecked { ++i; }
        }
    }

    function getOwnedTokensPaginated(
        address owner,
        uint256 offset,
        uint256 limit
    )
        external
        view
        returns (
            uint256[] memory tokenIds,
            string[] memory metadataCIDs,
            uint256 totalCount
        )
    {
        totalCount = balanceOf(owner);
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        if (offset >= totalCount)
            return (new uint256[](0), new string[](0), totalCount);

        uint256 count = end - offset;
        tokenIds = new uint256[](count);
        metadataCIDs = new string[](count);
        for (uint256 i = 0; i < count; ) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, offset + i);
            tokenIds[i] = tokenId;
            metadataCIDs[i] = _metadataCID[tokenId];
            unchecked { ++i; }
        }
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Shared approve logic used by approveAccess and approveAccessWithPermissions
    function _doApprove(
        uint256 tokenId,
        address requester,
        uint64 duration
    ) internal {
        if (requester == address(0)) revert InvalidAddress();
        if (duration == 0) revert InvalidDuration();

        AccessRequest storage request = _access[tokenId][requester];
        if (request.status != AccessStatus.Pending) revert NoAccessRequest();

        uint64 expiresAt;
        unchecked { expiresAt = uint64(block.timestamp) + duration; }
        if (expiresAt < block.timestamp) revert DurationOverflow();

        request.status = AccessStatus.Approved;
        request.expiresAt = expiresAt;

        _pendingRequesters[tokenId].remove(requester);
        _grantedAddresses[tokenId].add(requester);   // track on-chain

        emit AccessApproved(tokenId, requester, expiresAt);
    }

    /// @dev Shared revoke logic used by revokeAccess and revokeAccessWithPermissions
    function _doRevoke(
        uint256 tokenId,
        address requester,
        string calldata reason
    ) internal {
        if (requester == address(0)) revert InvalidAddress();

        AccessRequest storage request = _access[tokenId][requester];
        require(
            request.status == AccessStatus.Approved,
            "No approved access to revoke"
        );

        delete _access[tokenId][requester];
        _grantedAddresses[tokenId].remove(requester);  // remove from on-chain list

        emit AccessRevoked(tokenId, requester, reason);
    }

    function _isValidCID(string memory cid) internal pure returns (bool) {
        bytes memory b = bytes(cid);
        uint256 len = b.length;

        if (len < 46 || len > 100) return false;

        // CIDv0: Qm + 44 base58 chars
        if (b[0] == "Q" && b[1] == "m") {
            if (len != 46) return false;
            for (uint256 i = 2; i < len; ) {
                bytes1 char = b[i];
                bool valid = (char >= "1" && char <= "9") ||
                    (char >= "A" && char <= "H") ||
                    (char >= "J" && char <= "N") ||
                    (char >= "P" && char <= "Z") ||
                    (char >= "a" && char <= "k") ||
                    (char >= "m" && char <= "z");
                if (!valid) return false;
                unchecked { ++i; }
            }
            return true;
        }

        // CIDv1: starts with 'b'
        if (b[0] == "b") {
            if (len < 59) return false;
            bytes1 multibase = b[1];
            bool validMultibase = (multibase == "a" || multibase == "u" ||
                                   multibase == "z" || multibase == "f");
            if (!validMultibase) return false;
            if (multibase == "a") {
                for (uint256 i = 2; i < len; ) {
                    bytes1 char = b[i];
                    if (!((char >= "a" && char <= "z") || (char >= "2" && char <= "7")))
                        return false;
                    unchecked { ++i; }
                }
            }
            return true;
        }

        return false;
    }

    function _checkAndUpdateRateLimit(address requester) internal {
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > _lastResetDay[requester]) {
            _requestCount[requester] = 0;
            _lastResetDay[requester] = currentDay;
        }
        if (_requestCount[requester] >= MAX_REQUESTS_PER_DAY) revert TooManyRequests();
        unchecked { _requestCount[requester]++; }
    }
}
