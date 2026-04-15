// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISoulboundIdentity {
    function ownerOf(uint256 tokenId) external view returns (address);
    function approveAccess(uint256 tokenId, address requester, uint64 duration) external;
    function revokeAccess(uint256 tokenId, address requester, string calldata reason) external;
}

interface ICredentialsHub {
    function grantCredentialAccess(uint256 tokenId, address viewer, uint8 types) external;
}

interface ISocialHub {
    function grantSocialAccess(uint256 tokenId, address viewer, uint8 sections) external;
}

/**
 * @title BatchAccessManager
 * @notice Orchestrates access approval/revocation across SoulboundIdentity, CredentialsHub,
 *         and SocialHub in a single transaction — keeping the three contracts decoupled from each other.
 * @dev The token owner calls this contract; it forwards calls to all three contracts.
 *      Each hub contract must have this contract registered as its batchManager via setBatchManager().
 *      SoulboundIdentity must also have this contract registered via setBatchManager().
 *
 * CREDENTIAL TYPES BITMASK:
 *   bit 0 (1)  = Degree
 *   bit 1 (2)  = Certification
 *   bit 2 (4)  = WorkExperience
 *   bit 3 (8)  = IdentityProof
 *   bit 4 (16) = Skill
 *
 * SOCIAL SECTIONS BITMASK:
 *   bit 0 (1) = Reviews
 *   bit 1 (2) = Projects
 *   bit 2 (4) = Endorsements
 */
contract BatchAccessManager {
    error NotTokenOwner();
    error InvalidAddress();

    ISoulboundIdentity public immutable soulbound;
    ICredentialsHub public immutable credentialsHub;
    ISocialHub public immutable socialHub;

    constructor(address _soulbound, address _credentialsHub, address _socialHub) {
        if (_soulbound == address(0) || _credentialsHub == address(0) || _socialHub == address(0))
            revert InvalidAddress();
        soulbound = ISoulboundIdentity(_soulbound);
        credentialsHub = ICredentialsHub(_credentialsHub);
        socialHub = ISocialHub(_socialHub);
    }

    /// @notice Approve access and set credential + social permissions in one transaction
    /// @param tokenId The identity token ID
    /// @param requester The address requesting access
    /// @param duration Duration of access in seconds
    /// @param credTypes Bitmask of credential types to grant (0 = none)
    /// @param socialSections Bitmask of social sections to grant (0 = none)
    function batchApproveAccess(
        uint256 tokenId,
        address requester,
        uint64 duration,
        uint8 credTypes,
        uint8 socialSections
    ) external {
        if (msg.sender != soulbound.ownerOf(tokenId)) revert NotTokenOwner();
        soulbound.approveAccess(tokenId, requester, duration);
        credentialsHub.grantCredentialAccess(tokenId, requester, credTypes);
        socialHub.grantSocialAccess(tokenId, requester, socialSections);
    }

    /// @notice Revoke access and clear credential + social permissions in one transaction
    /// @param tokenId The identity token ID
    /// @param requester The address to revoke access from
    /// @param reason Reason for revocation (for audit trail)
    function batchRevokeAccess(
        uint256 tokenId,
        address requester,
        string calldata reason
    ) external {
        if (msg.sender != soulbound.ownerOf(tokenId)) revert NotTokenOwner();
        soulbound.revokeAccess(tokenId, requester, reason);
        credentialsHub.grantCredentialAccess(tokenId, requester, 0);
        socialHub.grantSocialAccess(tokenId, requester, 0);
    }
}
