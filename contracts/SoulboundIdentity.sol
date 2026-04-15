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
 * @title SoulboundIdentity
 * @notice Soulbound identity tokens with privacy-controlled metadata access
 * @dev Extends ERC5484 with IPFS metadata and access control
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

    uint256 public constant REQUEST_COOLDOWN = 1 hours;
    uint256 public constant MAX_REQUESTS_PER_DAY = 10;

    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/

    // Sibling contracts — set by owner after deployment
    ICredentialsHub public credentialsHub;
    ISocialHub public socialHub;

    uint256 private _tokenIdCounter;

    mapping(uint256 => string) private _metadataCID;

    // Rate limiting
    mapping(address => mapping(uint256 => uint256)) private _lastRequestTime;
    mapping(address => uint256) private _requestCount;
    mapping(address => uint256) private _lastResetDay;

    // Pending requesters per token
    mapping(uint256 => EnumerableSet.AddressSet) private _pendingRequesters;

    // On-chain grantee tracking (replaces localStorage workaround)
    mapping(uint256 => EnumerableSet.AddressSet) private _grantedAddresses;

    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    enum AccessStatus { None, Pending, Approved, Denied }

    struct AccessRequest {
        AccessStatus status;
        uint64 expiresAt;
    }

    mapping(uint256 => mapping(address => AccessRequest)) private _access;

    /*//////////////////////////////////////////////////////////////
                        EVENTS
    //////////////////////////////////////////////////////////////*/

    event AccessRequested(uint256 indexed tokenId, address indexed requester);
    event AccessApproved(uint256 indexed tokenId, address indexed requester, uint64 expiresAt);
    event AccessDenied(uint256 indexed tokenId, address indexed requester);
    event AccessRevoked(uint256 indexed tokenId, address indexed requester, string reason);
    event AccessExpired(uint256 indexed tokenId, address indexed requester);
    event ExpiredAccessCleaned(uint256 indexed tokenId, uint256 count);

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
                    HUB REGISTRATION (call after deploying all 3)
    //////////////////////////////////////////////////////////////*/

    function setCredentialsHub(address hub) external onlyOwner {
        if (hub == address(0)) revert InvalidAddress();
        credentialsHub = ICredentialsHub(hub);
    }

    function setSocialHub(address hub) external onlyOwner {
        if (hub == address(0)) revert InvalidAddress();
        socialHub = ISocialHub(hub);
    }

    /*//////////////////////////////////////////////////////////////
                        PAUSABLE CONTROLS
    //////////////////////////////////////////////////////////////*/

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function isPaused() external view returns (bool) { return paused(); }

    /*//////////////////////////////////////////////////////////////
                              MINT
    //////////////////////////////////////////////////////////////*/

    function mint(string calldata ipfsCID, BurnAuth burnAuth) external returns (uint256) {
        if (balanceOf(msg.sender) > 0) revert AlreadyHasToken();
        return _mint(msg.sender, ipfsCID, burnAuth);
    }

    function _mint(address to, string calldata ipfsCID, BurnAuth burnAuth) internal returns (uint256) {
        if (bytes(ipfsCID).length == 0) revert EmptyIPFSCID();
        if (!_isValidCID(ipfsCID)) revert InvalidIPFSCID();
        uint256 tokenId;
        unchecked { tokenId = ++_tokenIdCounter; }
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

        EnumerableSet.AddressSet storage pending = _pendingRequesters[tokenId];
        for (uint256 i = pending.length(); i > 0; ) {
            unchecked { --i; }
            pending.remove(pending.at(i));
        }

        EnumerableSet.AddressSet storage granted = _grantedAddresses[tokenId];
        for (uint256 i = granted.length(); i > 0; ) {
            unchecked { --i; }
            granted.remove(granted.at(i));
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL LOGIC
    //////////////////////////////////////////////////////////////*/

    function requestAccess(uint256 tokenId) external {
        if (msg.sender == ownerOf(tokenId)) revert OwnerHasAccess();

        uint256 lastRequest = _lastRequestTime[msg.sender][tokenId];
        if (block.timestamp < lastRequest + REQUEST_COOLDOWN)
            revert RequestCooldown((lastRequest + REQUEST_COOLDOWN) - block.timestamp);

        _checkAndUpdateRateLimit(msg.sender);

        AccessRequest storage request = _access[tokenId][msg.sender];

        if (request.status == AccessStatus.Approved && block.timestamp >= request.expiresAt) {
            emit AccessExpired(tokenId, msg.sender);
            request.status = AccessStatus.None;
        }

        if (request.status == AccessStatus.Pending) revert RequestAlreadyExists();

        request.status = AccessStatus.Pending;
        _lastRequestTime[msg.sender][tokenId] = block.timestamp;
        _pendingRequesters[tokenId].add(msg.sender);
        emit AccessRequested(tokenId, msg.sender);
    }

    /// @notice Approve profile access only
    function approveAccess(
        uint256 tokenId,
        address requester,
        uint64 duration
    ) external onlyTokenOwner(tokenId) {
        _doApprove(tokenId, requester, duration);
    }

    /// @notice Approve profile + credentials + social in ONE transaction
    /// @param credTypes    Bitmask: bit0=Degree,bit1=Cert,bit2=Work,bit3=Identity,bit4=Skill
    /// @param socialSections Bitmask: bit0=Reviews,bit1=Projects,bit2=Endorsements
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

    function denyAccess(uint256 tokenId, address requester) external onlyTokenOwner(tokenId) {
        if (requester == address(0)) revert InvalidAddress();
        AccessRequest storage request = _access[tokenId][requester];
        if (request.status != AccessStatus.Pending) revert NoAccessRequest();
        request.status = AccessStatus.Denied;
        _pendingRequesters[tokenId].remove(requester);
        emit AccessDenied(tokenId, requester);
    }

    /// @notice Revoke profile access only (credential/social grants remain)
    function revokeAccess(
        uint256 tokenId,
        address requester,
        string calldata reason
    ) external onlyTokenOwner(tokenId) {
        _doRevoke(tokenId, requester, reason);
    }

    /// @notice Revoke profile + clear credential + social grants in ONE transaction
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

    function cleanExpiredAccess(
        uint256 tokenId,
        address[] calldata addresses
    ) external returns (uint256 count) {
        for (uint256 i = 0; i < addresses.length; ) {
            AccessRequest storage request = _access[tokenId][addresses[i]];
            if (request.status == AccessStatus.Approved && block.timestamp >= request.expiresAt) {
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
                        METADATA & ACCESS VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the IPFS CID — matches the frontend ABI call
    function getMetadata(uint256 tokenId) external view returns (string memory) {
        return _metadataCID[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return _metadataCID[tokenId];
    }

    /// @notice Total tokens ever minted — lets the frontend scan the correct range
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @notice All addresses currently granted access — replaces localStorage
    function getGrantedAddresses(uint256 tokenId) external view returns (address[] memory) {
        EnumerableSet.AddressSet storage set = _grantedAddresses[tokenId];
        uint256 len = set.length();
        address[] memory result = new address[](len);
        for (uint256 i = 0; i < len; ) {
            result[i] = set.at(i);
            unchecked { ++i; }
        }
        return result;
    }

    function canView(uint256 tokenId, address viewer) external view returns (bool) {
        if (viewer == ownerOf(tokenId)) return true;
        AccessRequest storage request = _access[tokenId][viewer];
        return request.status == AccessStatus.Approved && block.timestamp < request.expiresAt;
    }

    function checkAccess(
        uint256 tokenId,
        address requester
    ) external view returns (bool hasAccess, uint64 expiresAt) {
        if (requester == ownerOf(tokenId)) return (true, type(uint64).max);
        AccessRequest storage request = _access[tokenId][requester];
        if (request.status == AccessStatus.Approved && block.timestamp < request.expiresAt)
            return (true, request.expiresAt);
        return (false, 0);
    }

    function getAccessStatus(uint256 tokenId, address requester) external view returns (AccessStatus) {
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

    function tokensOfOwner(address owner) external view returns (uint256[] memory tokenIds) {
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
    ) external view returns (
        uint256[] memory tokenIds,
        string[] memory metadataCIDs,
        uint256 totalCount
    ) {
        totalCount = balanceOf(owner);
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        if (offset >= totalCount) return (new uint256[](0), new string[](0), totalCount);
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

    function _doApprove(uint256 tokenId, address requester, uint64 duration) internal {
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
        _grantedAddresses[tokenId].add(requester);
        emit AccessApproved(tokenId, requester, expiresAt);
    }

    function _doRevoke(uint256 tokenId, address requester, string calldata reason) internal {
        if (requester == address(0)) revert InvalidAddress();
        AccessRequest storage request = _access[tokenId][requester];
        require(request.status == AccessStatus.Approved, "No approved access to revoke");
        delete _access[tokenId][requester];
        _grantedAddresses[tokenId].remove(requester);
        emit AccessRevoked(tokenId, requester, reason);
    }

    function _isValidCID(string memory cid) internal pure returns (bool) {
        bytes memory b = bytes(cid);
        uint256 len = b.length;
        if (len < 46 || len > 100) return false;
        if (b[0] == "Q" && b[1] == "m") {
            if (len != 46) return false;
            for (uint256 i = 2; i < len; ) {
                bytes1 char = b[i];
                bool valid = (char >= "1" && char <= "9") || (char >= "A" && char <= "H") ||
                    (char >= "J" && char <= "N") || (char >= "P" && char <= "Z") ||
                    (char >= "a" && char <= "k") || (char >= "m" && char <= "z");
                if (!valid) return false;
                unchecked { ++i; }
            }
            return true;
        }
        if (b[0] == "b") {
            if (len < 59) return false;
            bytes1 multibase = b[1];
            if (!(multibase == "a" || multibase == "u" || multibase == "z" || multibase == "f")) return false;
            if (multibase == "a") {
                for (uint256 i = 2; i < len; ) {
                    bytes1 char = b[i];
                    if (!((char >= "a" && char <= "z") || (char >= "2" && char <= "7"))) return false;
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
