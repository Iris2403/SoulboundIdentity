// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC5484.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface ICredentialsHub {
    function grantCredentialAccess(uint256 tokenId, address viewer, uint8 types) external;
}

interface ISocialHub {
    function grantSocialAccess(uint256 tokenId, address viewer, uint8 sections) external;
}

/**
 * @title SoulboundIdentity V3.0
 * @notice Soulbound identity tokens with privacy-controlled metadata access
 * @dev Extends ERC5484 with IPFS metadata and access control
 *
 * CHANGES IN V3.0:
 * ✅ approveAccessWithPermissions — profile + credentials + social in ONE tx
 * ✅ revokeAccessWithPermissions  — revokes all three in ONE tx
 * ✅ getGrantedAddresses          — on-chain grantee list (replaces localStorage)
 * ✅ getMetadata                  — alias for tokenURI (matches frontend ABI)
 * ✅ totalSupply                  — exposes token counter for frontend scanning
 * ✅ setCredentialsHub / setSocialHub — register sibling contracts after deploy
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
    error HubsNotConfigured();

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Cooldown period between access requests from same address to same token
    uint256 public constant REQUEST_COOLDOWN = 1 hours;

    /// @notice Maximum access requests per address per day (anti-spam)
    uint256 public constant MAX_REQUESTS_PER_DAY = 10;

    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Sibling contracts — set once by owner after all three are deployed
    ICredentialsHub public credentialsHub;
    ISocialHub public socialHub;

    uint256 private _tokenIdCounter;

    /// @notice Mapping from token ID to IPFS metadata CID
    mapping(uint256 => string) private _metadataCID;

    /// @notice Rate limiting: last request time per address per token
    mapping(address => mapping(uint256 => uint256)) private _lastRequestTime;

    /// @notice Rate limiting: daily request count per address
    mapping(address => uint256) private _requestCount;

    /// @notice Rate limiting: last reset day per address
    mapping(address => uint256) private _lastResetDay;

    /// @notice EnumerableSet for efficient pending requester management
    mapping(uint256 => EnumerableSet.AddressSet) private _pendingRequesters;

    /// @notice On-chain grantee tracking — replaces unreliable localStorage
    mapping(uint256 => EnumerableSet.AddressSet) private _grantedAddresses;

    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    /// @notice Status of an access request
    enum AccessStatus {
        None,
        Pending,
        Approved,
        Denied
    }

    /// @notice Structure for access requests
    struct AccessRequest {
        AccessStatus status;
        uint64 expiresAt;
    }

    /// @notice Mapping from token ID to requester address to access request
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

    /*//////////////////////////////////////////////////////////////
                        MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Restricts function access to token owner only
    modifier onlyTokenOwner(uint256 tokenId) {
        if (msg.sender != ownerOf(tokenId)) revert OnlyTokenOwner();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() ERC5484("Soulbound Identity", "SBTID") Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                    HUB REGISTRATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Register the CredentialsHub address — call once after deploying all three contracts
    /// @param hub Address of the deployed CredentialsHub
    function setCredentialsHub(address hub) external onlyOwner {
        if (hub == address(0)) revert InvalidAddress();
        credentialsHub = ICredentialsHub(hub);
    }

    /// @notice Register the SocialHub address — call once after deploying all three contracts
    /// @param hub Address of the deployed SocialHub
    function setSocialHub(address hub) external onlyOwner {
        if (hub == address(0)) revert InvalidAddress();
        socialHub = ISocialHub(hub);
    }

    /*//////////////////////////////////////////////////////////////
                        PAUSABLE CONTROLS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emergency pause for all minting and burning operations
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume normal operations after emergency pause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Check if contract is currently paused
    function isPaused() external view returns (bool) {
        return paused();
    }

    /*//////////////////////////////////////////////////////////////
                              MINT
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint a new soulbound identity token (self-mint only, one per address)
    /// @param ipfsCID IPFS CID for metadata (validated)
    /// @param burnAuth Burn authorization type
    /// @return tokenId The minted token ID
    function mint(
        string calldata ipfsCID,
        BurnAuth burnAuth
    ) external returns (uint256) {
        if (balanceOf(msg.sender) > 0) revert AlreadyHasToken();
        return _mint(msg.sender, ipfsCID, burnAuth);
    }

    /// @notice Internal mint function
    /// @param to Recipient address
    /// @param ipfsCID IPFS CID for metadata
    /// @param burnAuth Burn authorization type
    /// @return tokenId The minted token ID
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

    /// @notice Burn a soulbound token with cleanup
    /// @param tokenId The token ID to burn
    function burn(uint256 tokenId) external {
        _burnSBT(tokenId);
        delete _metadataCID[tokenId];

        // Clean up pending requesters EnumerableSet
        EnumerableSet.AddressSet storage pending = _pendingRequesters[tokenId];
        uint256 length = pending.length();
        for (uint256 i = length; i > 0; ) {
            unchecked {
                --i;
            }
            pending.remove(pending.at(i));
        }

        // Clean up granted addresses EnumerableSet
        EnumerableSet.AddressSet storage granted = _grantedAddresses[tokenId];
        uint256 grantedLength = granted.length();
        for (uint256 i = grantedLength; i > 0; ) {
            unchecked {
                --i;
            }
            granted.remove(granted.at(i));
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Request access to a token's metadata
    /// @param tokenId The token ID to request access to
    function requestAccess(uint256 tokenId) external {
        if (msg.sender == ownerOf(tokenId)) revert OwnerHasAccess();

        // Check cooldown
        uint256 lastRequest = _lastRequestTime[msg.sender][tokenId];
        if (block.timestamp < lastRequest + REQUEST_COOLDOWN) {
            revert RequestCooldown(
                (lastRequest + REQUEST_COOLDOWN) - block.timestamp
            );
        }

        // Check rate limits
        _checkAndUpdateRateLimit(msg.sender);

        AccessRequest storage request = _access[tokenId][msg.sender];

        // If approved but expired, allow new request
        if (
            request.status == AccessStatus.Approved &&
            block.timestamp >= request.expiresAt
        ) {
            emit AccessExpired(tokenId, msg.sender);
            request.status = AccessStatus.None;
        }

        // Prevent duplicate pending requests
        if (request.status == AccessStatus.Pending)
            revert RequestAlreadyExists();

        request.status = AccessStatus.Pending;
        _lastRequestTime[msg.sender][tokenId] = block.timestamp;

        // Add to EnumerableSet
        _pendingRequesters[tokenId].add(msg.sender);

        emit AccessRequested(tokenId, msg.sender);
    }

    /// @notice Approve an access request — profile access only
    /// @param tokenId The token ID
    /// @param requester The address requesting access
    /// @param duration Duration of access in seconds
    function approveAccess(
        uint256 tokenId,
        address requester,
        uint64 duration
    ) external onlyTokenOwner(tokenId) {
        _doApprove(tokenId, requester, duration);
    }

    /// @notice Approve an access request — profile + credentials + social in ONE transaction
    /// @param tokenId The token ID
    /// @param requester The address requesting access
    /// @param duration Duration of access in seconds
    /// @param credTypes Bitmask of credential types: bit0=Degree, bit1=Cert, bit2=Work, bit3=Identity, bit4=Skill
    /// @param socialSections Bitmask of social sections: bit0=Reviews, bit1=Projects, bit2=Endorsements
    function approveAccessWithPermissions(
        uint256 tokenId,
        address requester,
        uint64 duration,
        uint8 credTypes,
        uint8 socialSections
    ) external onlyTokenOwner(tokenId) {
        if (address(credentialsHub) == address(0) || address(socialHub) == address(0))
            revert HubsNotConfigured();

        _doApprove(tokenId, requester, duration);
        credentialsHub.grantCredentialAccess(tokenId, requester, credTypes);
        socialHub.grantSocialAccess(tokenId, requester, socialSections);
    }

    /// @notice Deny an access request
    /// @param tokenId The token ID
    /// @param requester The address requesting access
    function denyAccess(
        uint256 tokenId,
        address requester
    ) external onlyTokenOwner(tokenId) {
        if (requester == address(0)) revert InvalidAddress();

        AccessRequest storage request = _access[tokenId][requester];
        if (request.status != AccessStatus.Pending) revert NoAccessRequest();

        request.status = AccessStatus.Denied;

        // Remove from pending set
        _pendingRequesters[tokenId].remove(requester);

        emit AccessDenied(tokenId, requester);
    }

    /// @notice Revoke approved access — profile access only
    /// @param tokenId The token ID
    /// @param requester The address to revoke access from
    /// @param reason Reason for revocation (for audit trail)
    function revokeAccess(
        uint256 tokenId,
        address requester,
        string calldata reason
    ) external onlyTokenOwner(tokenId) {
        _doRevoke(tokenId, requester, reason);
    }

    /// @notice Revoke approved access — profile + clears credential + social grants in ONE transaction
    /// @param tokenId The token ID
    /// @param requester The address to revoke access from
    /// @param reason Reason for revocation (for audit trail)
    function revokeAccessWithPermissions(
        uint256 tokenId,
        address requester,
        string calldata reason
    ) external onlyTokenOwner(tokenId) {
        if (address(credentialsHub) == address(0) || address(socialHub) == address(0))
            revert HubsNotConfigured();

        _doRevoke(tokenId, requester, reason);
        credentialsHub.grantCredentialAccess(tokenId, requester, 0);
        socialHub.grantSocialAccess(tokenId, requester, 0);
    }

    /// @notice Clean expired access entries manually
    /// @param tokenId The token ID
    /// @param addresses Addresses with potentially expired access
    /// @return count Number of expired entries cleaned
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
                unchecked {
                    ++count;
                }
            }

            unchecked {
                ++i;
            }
        }

        if (count > 0) {
            emit ExpiredAccessCleaned(tokenId, count);
        }
    }

    /*//////////////////////////////////////////////////////////////
                        METADATA & ACCESS VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get token's IPFS metadata CID — matches frontend ABI call
    /// @param tokenId The token ID
    /// @return The IPFS CID
    function getMetadata(uint256 tokenId) external view returns (string memory) {
        return _metadataCID[tokenId];
    }

    /// @notice Get token's IPFS metadata CID
    /// @param tokenId The token ID
    /// @return The IPFS CID
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return _metadataCID[tokenId];
    }

    /// @notice Highest token ID ever minted — lets frontend scan the correct range
    /// @dev Different from ERC721Enumerable.totalSupply() which decreases on burn;
    ///      this value never decreases, so IDs 1..lastTokenId() cover all past tokens.
    /// @return The current token ID counter
    function lastTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @notice Get all addresses that have been granted access to a token
    /// @dev Replaces the unreliable localStorage workaround in the frontend
    /// @param tokenId The token ID
    /// @return Array of addresses with granted (possibly expired) access
    function getGrantedAddresses(
        uint256 tokenId
    ) external view returns (address[] memory) {
        EnumerableSet.AddressSet storage set = _grantedAddresses[tokenId];
        uint256 len = set.length();
        address[] memory result = new address[](len);

        for (uint256 i = 0; i < len; ) {
            result[i] = set.at(i);
            unchecked {
                ++i;
            }
        }

        return result;
    }

    /// @notice Check if an address can view a token's metadata
    /// @param tokenId The token ID
    /// @param viewer The address to check
    /// @return True if viewer has permission to view metadata
    function canView(
        uint256 tokenId,
        address viewer
    ) external view returns (bool) {
        // Owner can always view
        if (viewer == ownerOf(tokenId)) {
            return true;
        }

        AccessRequest storage request = _access[tokenId][viewer];

        // Check if approved and not expired
        if (request.status == AccessStatus.Approved) {
            return block.timestamp < request.expiresAt;
        }

        return false;
    }

    /// @notice Check if an address has access to a token
    /// @param tokenId The token ID
    /// @param requester The address to check
    /// @return hasAccess True if requester has access
    /// @return expiresAt Expiration timestamp (0 if not applicable)
    function checkAccess(
        uint256 tokenId,
        address requester
    ) external view returns (bool hasAccess, uint64 expiresAt) {
        // Owner always has access
        if (requester == ownerOf(tokenId)) {
            return (true, type(uint64).max);
        }

        AccessRequest storage request = _access[tokenId][requester];

        // Check if approved and not expired
        if (request.status == AccessStatus.Approved) {
            if (block.timestamp < request.expiresAt) {
                return (true, request.expiresAt);
            }
        }

        return (false, 0);
    }

    /// @notice Get access request status
    /// @param tokenId The token ID
    /// @param requester The address to check
    /// @return status The current access status
    function getAccessStatus(
        uint256 tokenId,
        address requester
    ) external view returns (AccessStatus status) {
        return _access[tokenId][requester].status;
    }

    /// @notice Get pending access requests for a token (paginated)
    /// @param tokenId The token ID
    /// @param offset Starting index
    /// @param limit Number of requesters to return
    /// @return requesters Array of pending requester addresses
    /// @return totalCount Total number of pending requests
    function getPendingRequests(
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory requesters, uint256 totalCount) {
        EnumerableSet.AddressSet storage pending = _pendingRequesters[tokenId];
        totalCount = pending.length();

        // Calculate actual range
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        if (offset >= totalCount) {
            return (new address[](0), totalCount);
        }

        uint256 count = end - offset;
        requesters = new address[](count);

        // Fill array from EnumerableSet
        for (uint256 i = 0; i < count; ) {
            requesters[i] = pending.at(offset + i);
            unchecked {
                ++i;
            }
        }

        return (requesters, totalCount);
    }

    /// @notice Get all tokens owned by an address
    /// @param owner The address to query
    /// @return tokenIds Array of token IDs owned by the address
    function tokensOfOwner(
        address owner
    ) external view returns (uint256[] memory tokenIds) {
        uint256 balance = balanceOf(owner);
        tokenIds = new uint256[](balance);

        for (uint256 i = 0; i < balance; ) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);

            unchecked {
                ++i;
            }
        }

        return tokenIds;
    }

    /// @notice Get tokens with metadata (paginated)
    /// @param owner The address to query
    /// @param offset Starting index
    /// @param limit Number of tokens to return
    /// @return tokenIds Array of token IDs
    /// @return metadataCIDs Array of IPFS CIDs
    /// @return totalCount Total tokens owned by address
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

        // Calculate actual range
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        if (offset >= totalCount) {
            return (new uint256[](0), new string[](0), totalCount);
        }

        uint256 count = end - offset;
        tokenIds = new uint256[](count);
        metadataCIDs = new string[](count);

        // Fill arrays
        for (uint256 i = 0; i < count; ) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, offset + i);
            tokenIds[i] = tokenId;
            metadataCIDs[i] = _metadataCID[tokenId];

            unchecked {
                ++i;
            }
        }

        return (tokenIds, metadataCIDs, totalCount);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Shared approve logic — used by approveAccess and approveAccessWithPermissions
    /// @param tokenId The token ID
    /// @param requester The address requesting access
    /// @param duration Duration of access in seconds
    function _doApprove(
        uint256 tokenId,
        address requester,
        uint64 duration
    ) internal {
        if (requester == address(0)) revert InvalidAddress();
        if (duration == 0) revert InvalidDuration();

        AccessRequest storage request = _access[tokenId][requester];
        if (request.status != AccessStatus.Pending) revert NoAccessRequest();

        // Calculate expiration with overflow protection
        uint64 expiresAt;
        unchecked {
            expiresAt = uint64(block.timestamp) + duration;
        }
        if (expiresAt < block.timestamp) revert DurationOverflow();

        request.status = AccessStatus.Approved;
        request.expiresAt = expiresAt;

        // Remove from pending set, add to granted set
        _pendingRequesters[tokenId].remove(requester);
        _grantedAddresses[tokenId].add(requester);

        emit AccessApproved(tokenId, requester, expiresAt);
    }

    /// @notice Shared revoke logic — used by revokeAccess and revokeAccessWithPermissions
    /// @param tokenId The token ID
    /// @param requester The address to revoke access from
    /// @param reason Reason for revocation
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

        // Remove from granted set
        _grantedAddresses[tokenId].remove(requester);

        emit AccessRevoked(tokenId, requester, reason);
    }

    /// @notice Enhanced IPFS CID validation
    /// @param cid The IPFS CID to validate
    /// @return True if valid CID format
    function _isValidCID(string memory cid) internal pure returns (bool) {
        bytes memory b = bytes(cid);
        uint256 len = b.length;

        // Check length bounds
        if (len < 46) return false;
        if (len > 100) return false;

        // CIDv0: Qm + 44 base58 chars = 46 total
        if (b[0] == "Q" && b[1] == "m") {
            if (len != 46) return false;

            // Validate base58 characters
            for (uint256 i = 2; i < len; ) {
                bytes1 char = b[i];

                bool valid = (char >= "1" && char <= "9") ||
                    (char >= "A" && char <= "H") ||
                    (char >= "J" && char <= "N") ||
                    (char >= "P" && char <= "Z") ||
                    (char >= "a" && char <= "k") ||
                    (char >= "m" && char <= "z");

                if (!valid) return false;

                unchecked {
                    ++i;
                }
            }

            return true;
        }

        // CIDv1: starts with 'b'
        if (b[0] == "b") {
            if (len < 59) return false;

            bytes1 multibase = b[1];
            bool validMultibase = (multibase == "a" ||
                multibase == "u" ||
                multibase == "z" ||
                multibase == "f");

            if (!validMultibase) return false;

            // For base32, validate remaining characters
            if (multibase == "a") {
                for (uint256 i = 2; i < len; ) {
                    bytes1 char = b[i];
                    bool valid = (char >= "a" && char <= "z") ||
                        (char >= "2" && char <= "7");

                    if (!valid) return false;

                    unchecked {
                        ++i;
                    }
                }
            }

            return true;
        }

        return false;
    }

    /// @notice Check and update rate limit for requester
    /// @param requester The address to check
    function _checkAndUpdateRateLimit(address requester) internal {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastDay = _lastResetDay[requester];

        // Reset count if new day
        if (currentDay > lastDay) {
            _requestCount[requester] = 0;
            _lastResetDay[requester] = currentDay;
        }

        // Check limit
        if (_requestCount[requester] >= MAX_REQUESTS_PER_DAY) {
            revert TooManyRequests();
        }

        // Increment count
        unchecked {
            _requestCount[requester]++;
        }
    }
}
