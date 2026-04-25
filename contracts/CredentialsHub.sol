// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CredentialsHub - UNIFIED REGISTRY
 * @notice Single contract for all professional credentials
 * @dev Merges: Degrees, Certifications, WorkExperience, IdentityProofs, Skills
 *
 * DESIGN PHILOSOPHY:
 * - All credentials share similar structure: hash + issuer + dates
 * - Different types distinguished by enum
 * - Single storage pattern reduces code duplication
 * - Simple issuer authorization (trusted list)
 * - Per-type selective credential disclosure
 *
 * CREDENTIAL TYPES:
 * 1. Degree - Academic degrees
 * 2. Certification - Professional certifications
 * 3. WorkExperience - Job history
 * 4. IdentityProof - KYC/verification proofs
 * 5. Skill - Technical/soft skills
 *
 * GRANTED TYPES BITMASK:
 *   bit 0 (1)  = Degree
 *   bit 1 (2)  = Certification
 *   bit 2 (4)  = WorkExperience
 *   bit 3 (8)  = IdentityProof
 *   bit 4 (16) = Skill
 *
 * OFF-CHAIN (IPFS metadata):
 * - Degree: institution, field, level, GPA
 * - Cert: name, organization, cert number
 * - Work: company, position, description, achievements
 * - ID: verification method, documents, proofs
 * - Skill: name, proficiency, endorsements
 */

interface ISoulboundIdentity {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract CredentialsHub is Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                            CUSTOM ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotTokenOwner();
    error NotAuthorizedIssuer();
    error CredentialNotFound();
    error InvalidDates();
    error InvalidParameter();
    error NoAccess();
    error TooManyCredentials();

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant MAX_CREDENTIALS_PER_TYPE = 100;

    /*//////////////////////////////////////////////////////////////
                            ENUMS
    //////////////////////////////////////////////////////////////*/

    /// @notice Credential type classification
    enum CredentialType {
        Degree, // bit 0
        Certification, // bit 1
        WorkExperience, // bit 2
        IdentityProof, // bit 3
        Skill // bit 4
    }

    /// @notice Credential status
    enum CredentialStatus {
        Active,
        Revoked,
        Expired
    }

    /// @notice Skill categories
    enum SkillCategory {
        Technical,
        Soft,
        Language,
        Domain,
        Tool,
        Other
    }

    /// @notice Academic degree category
    enum DegreeCategory {
        ArtsAndHumanities,
        BusinessAndEconomics,
        LawAndSocialSciences,
        EducationAndDevelopment,
        HealthAndLifeSciences,
        ScienceAndTechnology
    }

    /// @notice Certification domain / sector
    enum CertificationDomain {
        ITSoftwareDevelopment,
        BusinessManagement,
        HealthMedicine,
        DataAIAnalytics,
        CommunicationMarketing
    }

    /*//////////////////////////////////////////////////////////////
                            STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Universal credential structure
    /// @dev Flexible enough for all credential types
    struct Credential {
        uint256 credentialId;
        CredentialType credType;
        bytes32 metadataHash; // IPFS CID hash
        address issuer; // Who issued/verified
        uint64 issueDate; // When issued
        uint64 expiryDate; // Expiry (0 = never expires)
        CredentialStatus status; // Current status
        uint8 category; // For skills: SkillCategory, others: unused
        bool verified; // Issuer-verified flag
    }

    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Reference to identity contract
    ISoulboundIdentity public immutable identity;

    /// @notice Authorized issuers per credential type
    mapping(CredentialType => mapping(address => bool))
        public authorizedIssuers;

    /// @notice Credential counters
    uint256 private _credentialIdCounter;

    /// @notice Core storage: tokenId => credentialId => Credential
    mapping(uint256 => mapping(uint256 => Credential)) public credentials;

    /// @notice Token's credentials by type: tokenId => type => credentialId[]
    mapping(uint256 => mapping(CredentialType => uint256[]))
        private credentialsByType;

    /// @notice Count by type: tokenId => type => count
    mapping(uint256 => mapping(CredentialType => uint256))
        public credentialCount;

    /// @notice Per-type access grants: tokenId => viewer => bitmask of allowed CredentialTypes
    mapping(uint256 => mapping(address => uint8)) public grantedTypes;

    /// @notice GPA for degree credentials (stored * 100: e.g. 350 = 3.50)
    mapping(uint256 => uint16) public degreeGPA;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event CredentialIssued(
        uint256 indexed tokenId,
        uint256 indexed credentialId,
        CredentialType indexed credType,
        address issuer
    );

    event CredentialRevoked(
        uint256 indexed credentialId,
        address indexed revoker
    );

    event CredentialStatusChanged(
        uint256 indexed credentialId,
        CredentialStatus newStatus
    );

    event IssuerAuthorized(
        CredentialType indexed credType,
        address indexed issuer,
        bool authorized
    );

    event CredentialAccessGranted(
        uint256 indexed tokenId,
        address indexed viewer,
        uint8 types
    );

    event DegreeCredentialAdded(
        uint256 indexed tokenId,
        uint256 indexed credentialId,
        uint16 gpa,
        DegreeCategory degreeCategory
    );

    event CertificationCredentialAdded(
        uint256 indexed tokenId,
        uint256 indexed credentialId,
        CertificationDomain domain
    );

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyTokenOwner(uint256 tokenId) {
        if (msg.sender != identity.ownerOf(tokenId)) revert NotTokenOwner();
        _;
    }

    modifier onlyAuthorizedIssuer(CredentialType credType) {
        if (!authorizedIssuers[credType][msg.sender])
            revert NotAuthorizedIssuer();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _identityContract) Ownable(msg.sender) {
        identity = ISoulboundIdentity(_identityContract);
    }

    /*//////////////////////////////////////////////////////////////
                        ISSUER MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Authorize an issuer for a credential type
    function setIssuerAuthorization(
        CredentialType credType,
        address issuer,
        bool authorized
    ) external onlyOwner {
        authorizedIssuers[credType][issuer] = authorized;
        emit IssuerAuthorized(credType, issuer, authorized);
    }

    /// @notice Batch authorize issuers
    function batchAuthorizeIssuers(
        CredentialType credType,
        address[] calldata issuers,
        bool authorized
    ) external onlyOwner {
        for (uint256 i = 0; i < issuers.length; i++) {
            authorizedIssuers[credType][issuers[i]] = authorized;
            emit IssuerAuthorized(credType, issuers[i], authorized);
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ACCESS GRANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Grant a viewer access to specific credential types
    /// @param tokenId The identity token ID
    /// @param viewer The address to grant access to
    /// @param types Bitmask of CredentialTypes to allow (0 = revoke all)
    function grantCredentialAccess(
        uint256 tokenId,
        address viewer,
        uint8 types
    ) external onlyTokenOwner(tokenId) {
        grantedTypes[tokenId][viewer] = types;
        emit CredentialAccessGranted(tokenId, viewer, types);
    }

    /// @notice Grant multiple viewers the same credential type access in one transaction
    /// @param tokenId The identity token ID
    /// @param viewers Array of addresses to grant access to
    /// @param types Bitmask of CredentialTypes to allow (0 = revoke all)
    function batchGrantCredentialAccess(
        uint256 tokenId,
        address[] calldata viewers,
        uint8 types
    ) external onlyTokenOwner(tokenId) {
        for (uint256 i = 0; i < viewers.length; ) {
            grantedTypes[tokenId][viewers[i]] = types;
            emit CredentialAccessGranted(tokenId, viewers[i], types);
            unchecked {
                ++i;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ISSUE CREDENTIALS
    //////////////////////////////////////////////////////////////*/

    /// @notice Issue a credential to a token
    /// @param tokenId The identity token ID
    /// @param credType The credential type
    /// @param metadataHash IPFS CID hash
    /// @param issueDate Issue date (unix timestamp)
    /// @param expiryDate Expiry date (0 for non-expiring)
    /// @param category For skills, the SkillCategory; 0 for others
    /// @return credentialId The issued credential ID
    function issueCredential(
        uint256 tokenId,
        CredentialType credType,
        bytes32 metadataHash,
        uint64 issueDate,
        uint64 expiryDate,
        uint8 category
    ) external onlyAuthorizedIssuer(credType) nonReentrant returns (uint256) {
        if (metadataHash == bytes32(0)) revert InvalidParameter();
        if (issueDate == 0) revert InvalidParameter();
        if (expiryDate != 0 && expiryDate <= issueDate) revert InvalidDates();
        if (credentialCount[tokenId][credType] >= MAX_CREDENTIALS_PER_TYPE) {
            revert TooManyCredentials();
        }

        uint256 credentialId;
        unchecked {
            credentialId = ++_credentialIdCounter;
        }

        credentials[tokenId][credentialId] = Credential({
            credentialId: credentialId,
            credType: credType,
            metadataHash: metadataHash,
            issuer: msg.sender,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: CredentialStatus.Active,
            category: category,
            verified: true
        });

        credentialsByType[tokenId][credType].push(credentialId);
        credentialCount[tokenId][credType]++;

        emit CredentialIssued(tokenId, credentialId, credType, msg.sender);

        return credentialId;
    }

    /// @notice Self-add a credential (unverified)
    /// @dev User can add their own credentials, but marked as unverified
    function addCredential(
        uint256 tokenId,
        CredentialType credType,
        bytes32 metadataHash,
        uint64 issueDate,
        uint64 expiryDate,
        uint8 category
    ) external onlyTokenOwner(tokenId) nonReentrant returns (uint256) {
        if (metadataHash == bytes32(0)) revert InvalidParameter();
        if (issueDate == 0) revert InvalidParameter();
        if (expiryDate != 0 && expiryDate <= issueDate) revert InvalidDates();
        if (credentialCount[tokenId][credType] >= MAX_CREDENTIALS_PER_TYPE) {
            revert TooManyCredentials();
        }

        uint256 credentialId;
        unchecked {
            credentialId = ++_credentialIdCounter;
        }

        credentials[tokenId][credentialId] = Credential({
            credentialId: credentialId,
            credType: credType,
            metadataHash: metadataHash,
            issuer: msg.sender,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: CredentialStatus.Active,
            category: category,
            verified: false
        });

        credentialsByType[tokenId][credType].push(credentialId);
        credentialCount[tokenId][credType]++;

        emit CredentialIssued(tokenId, credentialId, credType, msg.sender);

        return credentialId;
    }

    /*//////////////////////////////////////////////////////////////
                    DEGREE CREDENTIALS (WITH GPA + CATEGORY)
    //////////////////////////////////////////////////////////////*/

    /// @notice Self-add a degree credential with GPA and category (unverified)
    /// @param tokenId The identity token ID
    /// @param metadataHash IPFS CID hash
    /// @param issueDate Issue date (unix timestamp)
    /// @param expiryDate Expiry date (0 for non-expiring)
    /// @param gpa GPA stored * 100 (e.g. 350 = 3.50)
    /// @param degreeCategory Category of the degree
    function addDegreeCredential(
        uint256 tokenId,
        bytes32 metadataHash,
        uint64 issueDate,
        uint64 expiryDate,
        uint16 gpa,
        DegreeCategory degreeCategory
    ) external onlyTokenOwner(tokenId) nonReentrant returns (uint256) {
        if (metadataHash == bytes32(0)) revert InvalidParameter();
        if (issueDate == 0) revert InvalidParameter();
        if (expiryDate != 0 && expiryDate <= issueDate) revert InvalidDates();
        if (credentialCount[tokenId][CredentialType.Degree] >= MAX_CREDENTIALS_PER_TYPE)
            revert TooManyCredentials();

        uint256 credentialId;
        unchecked {
            credentialId = ++_credentialIdCounter;
        }

        credentials[tokenId][credentialId] = Credential({
            credentialId: credentialId,
            credType: CredentialType.Degree,
            metadataHash: metadataHash,
            issuer: msg.sender,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: CredentialStatus.Active,
            category: uint8(degreeCategory),
            verified: false
        });

        degreeGPA[credentialId] = gpa;
        credentialsByType[tokenId][CredentialType.Degree].push(credentialId);
        credentialCount[tokenId][CredentialType.Degree]++;

        emit CredentialIssued(tokenId, credentialId, CredentialType.Degree, msg.sender);
        emit DegreeCredentialAdded(tokenId, credentialId, gpa, degreeCategory);

        return credentialId;
    }

    /// @notice Issue a degree credential with GPA and category (authorized issuer, verified)
    /// @param tokenId The identity token ID
    /// @param metadataHash IPFS CID hash
    /// @param issueDate Issue date (unix timestamp)
    /// @param expiryDate Expiry date (0 for non-expiring)
    /// @param gpa GPA stored * 100 (e.g. 350 = 3.50)
    /// @param degreeCategory Category of the degree
    function issueDegreeCredential(
        uint256 tokenId,
        bytes32 metadataHash,
        uint64 issueDate,
        uint64 expiryDate,
        uint16 gpa,
        DegreeCategory degreeCategory
    ) external onlyAuthorizedIssuer(CredentialType.Degree) nonReentrant returns (uint256) {
        if (metadataHash == bytes32(0)) revert InvalidParameter();
        if (issueDate == 0) revert InvalidParameter();
        if (expiryDate != 0 && expiryDate <= issueDate) revert InvalidDates();
        if (credentialCount[tokenId][CredentialType.Degree] >= MAX_CREDENTIALS_PER_TYPE)
            revert TooManyCredentials();

        uint256 credentialId;
        unchecked {
            credentialId = ++_credentialIdCounter;
        }

        credentials[tokenId][credentialId] = Credential({
            credentialId: credentialId,
            credType: CredentialType.Degree,
            metadataHash: metadataHash,
            issuer: msg.sender,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: CredentialStatus.Active,
            category: uint8(degreeCategory),
            verified: true
        });

        degreeGPA[credentialId] = gpa;
        credentialsByType[tokenId][CredentialType.Degree].push(credentialId);
        credentialCount[tokenId][CredentialType.Degree]++;

        emit CredentialIssued(tokenId, credentialId, CredentialType.Degree, msg.sender);
        emit DegreeCredentialAdded(tokenId, credentialId, gpa, degreeCategory);

        return credentialId;
    }

    /*//////////////////////////////////////////////////////////////
                CERTIFICATION CREDENTIALS (WITH DOMAIN)
    //////////////////////////////////////////////////////////////*/

    /// @notice Self-add a certification credential with domain (unverified)
    /// @param tokenId The identity token ID
    /// @param metadataHash IPFS CID hash
    /// @param issueDate Issue date (unix timestamp)
    /// @param expiryDate Expiry date (0 for non-expiring)
    /// @param domain The certification domain / sector
    function addCertificationCredential(
        uint256 tokenId,
        bytes32 metadataHash,
        uint64 issueDate,
        uint64 expiryDate,
        CertificationDomain domain
    ) external onlyTokenOwner(tokenId) nonReentrant returns (uint256) {
        if (metadataHash == bytes32(0)) revert InvalidParameter();
        if (issueDate == 0) revert InvalidParameter();
        if (expiryDate != 0 && expiryDate <= issueDate) revert InvalidDates();
        if (credentialCount[tokenId][CredentialType.Certification] >= MAX_CREDENTIALS_PER_TYPE)
            revert TooManyCredentials();

        uint256 credentialId;
        unchecked {
            credentialId = ++_credentialIdCounter;
        }

        credentials[tokenId][credentialId] = Credential({
            credentialId: credentialId,
            credType: CredentialType.Certification,
            metadataHash: metadataHash,
            issuer: msg.sender,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: CredentialStatus.Active,
            category: uint8(domain),
            verified: false
        });

        credentialsByType[tokenId][CredentialType.Certification].push(credentialId);
        credentialCount[tokenId][CredentialType.Certification]++;

        emit CredentialIssued(tokenId, credentialId, CredentialType.Certification, msg.sender);
        emit CertificationCredentialAdded(tokenId, credentialId, domain);

        return credentialId;
    }

    /// @notice Issue a certification credential with domain (authorized issuer, verified)
    /// @param tokenId The identity token ID
    /// @param metadataHash IPFS CID hash
    /// @param issueDate Issue date (unix timestamp)
    /// @param expiryDate Expiry date (0 for non-expiring)
    /// @param domain The certification domain / sector
    function issueCertificationCredential(
        uint256 tokenId,
        bytes32 metadataHash,
        uint64 issueDate,
        uint64 expiryDate,
        CertificationDomain domain
    ) external onlyAuthorizedIssuer(CredentialType.Certification) nonReentrant returns (uint256) {
        if (metadataHash == bytes32(0)) revert InvalidParameter();
        if (issueDate == 0) revert InvalidParameter();
        if (expiryDate != 0 && expiryDate <= issueDate) revert InvalidDates();
        if (credentialCount[tokenId][CredentialType.Certification] >= MAX_CREDENTIALS_PER_TYPE)
            revert TooManyCredentials();

        uint256 credentialId;
        unchecked {
            credentialId = ++_credentialIdCounter;
        }

        credentials[tokenId][credentialId] = Credential({
            credentialId: credentialId,
            credType: CredentialType.Certification,
            metadataHash: metadataHash,
            issuer: msg.sender,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: CredentialStatus.Active,
            category: uint8(domain),
            verified: true
        });

        credentialsByType[tokenId][CredentialType.Certification].push(credentialId);
        credentialCount[tokenId][CredentialType.Certification]++;

        emit CredentialIssued(tokenId, credentialId, CredentialType.Certification, msg.sender);
        emit CertificationCredentialAdded(tokenId, credentialId, domain);

        return credentialId;
    }

    /*//////////////////////////////////////////////////////////////
                        REVOKE/UPDATE CREDENTIALS
    //////////////////////////////////////////////////////////////*/

    /// @notice Revoke a credential
    function revokeCredential(uint256 tokenId, uint256 credentialId) external {
        Credential storage cred = credentials[tokenId][credentialId];
        if (cred.credentialId == 0) revert CredentialNotFound();

        bool isIssuer = msg.sender == cred.issuer;
        bool isOwner = msg.sender == identity.ownerOf(tokenId);

        if (!isIssuer && !isOwner) revert NotAuthorizedIssuer();

        cred.status = CredentialStatus.Revoked;

        emit CredentialRevoked(credentialId, msg.sender);
    }

    /// @notice Update credential status (mark as expired)
    function updateCredentialStatus(
        uint256 tokenId,
        uint256 credentialId
    ) external {
        Credential storage cred = credentials[tokenId][credentialId];
        if (cred.credentialId == 0) revert CredentialNotFound();

        if (cred.expiryDate != 0 && block.timestamp >= cred.expiryDate) {
            cred.status = CredentialStatus.Expired;
            emit CredentialStatusChanged(
                credentialId,
                CredentialStatus.Expired
            );
        }
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get a specific credential — checks access for that credential's type
    function getCredential(
        uint256 tokenId,
        uint256 credentialId
    ) external view returns (Credential memory) {
        Credential memory cred = credentials[tokenId][credentialId];
        if (cred.credentialId == 0) revert CredentialNotFound();
        if (!_canAccessType(tokenId, cred.credType)) revert NoAccess();
        return cred;
    }

    /// @notice Get all credentials of a specific type — checks access for that type only
    function getCredentialsByType(
        uint256 tokenId,
        CredentialType credType
    ) external view returns (Credential[] memory) {
        if (!_canAccessType(tokenId, credType)) revert NoAccess();

        uint256[] memory ids = credentialsByType[tokenId][credType];
        Credential[] memory result = new Credential[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = credentials[tokenId][ids[i]];
        }

        return result;
    }

    /// @notice Get all active credentials of a type — checks access for that type only
    function getActiveCredentials(
        uint256 tokenId,
        CredentialType credType
    ) external view returns (Credential[] memory) {
        if (!_canAccessType(tokenId, credType)) revert NoAccess();

        uint256[] memory ids = credentialsByType[tokenId][credType];

        uint256 activeCount = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Credential memory cred = credentials[tokenId][ids[i]];
            if (cred.status == CredentialStatus.Active) {
                if (cred.expiryDate == 0 || block.timestamp < cred.expiryDate) {
                    activeCount++;
                }
            }
        }

        Credential[] memory result = new Credential[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Credential memory cred = credentials[tokenId][ids[i]];
            if (cred.status == CredentialStatus.Active) {
                if (cred.expiryDate == 0 || block.timestamp < cred.expiryDate) {
                    result[index] = cred;
                    index++;
                }
            }
        }

        return result;
    }

    /// @notice Get credential count by type
    function getCredentialCount(
        uint256 tokenId,
        CredentialType credType
    ) external view returns (uint256) {
        return credentialCount[tokenId][credType];
    }

    /// @notice Get summary — returns 0 for types the caller has no access to
    function getCredentialSummary(
        uint256 tokenId
    )
        external
        view
        returns (
            uint256 degrees,
            uint256 certifications,
            uint256 workExperience,
            uint256 identityProofs,
            uint256 skills
        )
    {
        degrees = _canAccessType(tokenId, CredentialType.Degree)
            ? credentialCount[tokenId][CredentialType.Degree]
            : 0;
        certifications = _canAccessType(tokenId, CredentialType.Certification)
            ? credentialCount[tokenId][CredentialType.Certification]
            : 0;
        workExperience = _canAccessType(tokenId, CredentialType.WorkExperience)
            ? credentialCount[tokenId][CredentialType.WorkExperience]
            : 0;
        identityProofs = _canAccessType(tokenId, CredentialType.IdentityProof)
            ? credentialCount[tokenId][CredentialType.IdentityProof]
            : 0;
        skills = _canAccessType(tokenId, CredentialType.Skill)
            ? credentialCount[tokenId][CredentialType.Skill]
            : 0;
    }

    /// @notice Calculate total work experience across all WorkExperience credentials
    /// @dev issueDate = job start, expiryDate = job end (0 = currently employed)
    /// @param tokenId The identity token ID
    /// @return totalYears Full years of accumulated experience
    /// @return remainingMonths Remaining months after full years (approximate, 30-day months)
    function getTotalWorkExperience(
        uint256 tokenId
    ) external view returns (uint256 totalYears, uint256 remainingMonths) {
        uint256[] memory ids = credentialsByType[tokenId][CredentialType.WorkExperience];
        uint256 totalSeconds = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            Credential memory cred = credentials[tokenId][ids[i]];
            if (cred.status == CredentialStatus.Revoked) continue;

            uint64 start = cred.issueDate;
            uint64 end = cred.expiryDate == 0
                ? uint64(block.timestamp)
                : cred.expiryDate;

            if (end > start) {
                unchecked {
                    totalSeconds += end - start;
                }
            }
        }

        totalYears = totalSeconds / 365 days;
        remainingMonths = (totalSeconds % 365 days) / 30 days;
    }

    /// @notice Check if credential is currently valid
    function isCredentialValid(
        uint256 tokenId,
        uint256 credentialId
    ) external view returns (bool) {
        Credential memory cred = credentials[tokenId][credentialId];
        if (cred.credentialId == 0) return false;
        if (cred.status != CredentialStatus.Active) return false;
        if (cred.expiryDate != 0 && block.timestamp >= cred.expiryDate)
            return false;
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if caller can access a specific credential type for a token
    /// @dev Owner always has full access; others need the corresponding bit set in grantedTypes
    function _canAccessType(
        uint256 tokenId,
        CredentialType credType
    ) internal view returns (bool) {
        if (msg.sender == identity.ownerOf(tokenId)) return true;
        return (grantedTypes[tokenId][msg.sender] >> uint8(credType)) & 1 == 1;
    }
}
