// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SocialHub - SIMPLIFIED
 * @notice Social features: reputation, projects, and skill endorsements
 * @dev Optional contract for thesis - can be deployed separately
 *
 * FEATURES:
 * 1. Reputation - Simple peer reviews (no staking)
 * 2. Projects - Portfolio items with collaborators
 * 3. Endorsements - Skill validations from peers
 *
 * SIMPLIFICATIONS:
 * ✅ No staking mechanism
 * ✅ No complex anti-gaming (basic duplicate check)
 * ✅ No time decay algorithms
 * ✅ Simple overall score (not 5 dimensions)
 * ✅ Basic project status tracking
 * ✅ Simple endorsement counts
 *
 * GRANTED SECTIONS BITMASK:
 *   bit 0 (1) = Reviews / Reputation
 *   bit 1 (2) = Projects
 *   bit 2 (4) = Endorsements
 */

interface ISoulboundIdentity {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract SocialHub is Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                            CUSTOM ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotTokenOwner();
    error CannotReviewSelf();
    error AlreadyReviewed();
    error AlreadyEndorsedSkill();
    error ReviewNotFound();
    error ProjectNotFound();
    error NotProjectOwner();
    error InvalidScore();
    error InvalidParameter();
    error NoAccess();
    error TooMany();

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MAX_PROJECTS = 50;
    uint256 public constant MAX_COLLABORATORS = 20;
    uint8 public constant PREDEFINED_SKILL_COUNT = 16;

    /*//////////////////////////////////////////////////////////////
                            ENUMS
    //////////////////////////////////////////////////////////////*/

    enum ProjectStatus {
        Planning,
        Active,
        Completed,
        Cancelled
    }

    /// @notice Predefined standardized skill list (no free-text duplicates)
    enum PredefinedSkill {
        // Technical Skills (0-5)
        SoftwareDevelopment,
        WebDevelopment,
        DataAnalysis,
        AIMachineLearning,
        CybersecurityAwareness,
        BlockchainDevelopment,
        // Business Skills (6-10)
        ProjectManagement,
        BusinessStrategy,
        MarketingDigitalMarketing,
        SalesNegotiation,
        FinancialLiteracy,
        // Creative Skills (11-13)
        UIUXDesign,
        ContentCreation,
        VideoMediaProduction,
        // Soft Skills (14-15)
        CommunicationSkills,
        LeadershipTeamwork
    }

    /// @notice Skill grouping categories
    enum SkillCategory {
        Technical,
        Business,
        Creative,
        Soft
    }

    /*//////////////////////////////////////////////////////////////
                            STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Simple reputation review
    struct Review {
        uint256 reviewId;
        uint256 reviewerTokenId;
        uint8 score; // 0-100
        bool verified; // Did they work together?
        bool isAnonymous; // Hide reviewer identity
        uint64 createdAt;
        string comment; // Short on-chain comment (optional)
    }

    /// @notice Project portfolio item
    struct Project {
        uint256 projectId;
        bytes32 metadataHash; // IPFS CID
        uint64 createdAt;
        uint64 completedAt; // 0 if not completed
        ProjectStatus status;
        uint256[] collaborators; // TokenIds of collaborators
    }

    /// @notice Skill endorsement
    struct Endorsement {
        uint256 endorserId; // Who endorsed
        bytes32 skillHash; // Which skill (from CredentialsHub)
        uint64 endorsedAt;
        string comment; // Optional comment
    }

    /// @notice Reputation summary
    struct ReputationSummary {
        uint256 averageScore;
        uint256 totalReviews;
        uint256 verifiedReviews;
    }

    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/

    ISoulboundIdentity public immutable identity;

    // Reviews
    uint256 private _reviewIdCounter;
    mapping(uint256 => Review[]) private reviewsBySubject;
    mapping(uint256 => mapping(uint256 => bool)) private hasReviewedMap;

    // Cached reputation totals (avoids O(n) loop in getReputationSummary)
    mapping(uint256 => uint256) private _runningScoreTotal;
    mapping(uint256 => uint256) private _reviewCount;
    mapping(uint256 => uint256) private _verifiedCount;

    // Projects
    uint256 private _projectIdCounter;
    mapping(uint256 => mapping(uint256 => Project)) private projects;
    mapping(uint256 => uint256[]) private projectIdsByToken;

    // Endorsements
    mapping(uint256 => Endorsement[]) private endorsementsByToken;
    mapping(uint256 => mapping(bytes32 => uint256)) private endorsementCounts;

    /// @notice Per-section access grants: tokenId => viewer => bitmask
    mapping(uint256 => mapping(address => uint8)) public grantedSections;

    /// @notice Standardized skill endorsement counts: tokenId => skillId => count
    mapping(uint256 => mapping(uint8 => uint256)) private _standardSkillCount;

    /// @notice Duplicate-endorsement guard: subjectTokenId => skillId => endorserTokenId => bool
    mapping(uint256 => mapping(uint8 => mapping(uint256 => bool))) private _hasEndorsedStandardSkill;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event ReviewSubmitted(
        uint256 indexed subjectTokenId,
        uint256 indexed reviewerTokenId,
        uint256 indexed reviewId,
        uint8 score
    );

    event ProjectCreated(
        uint256 indexed tokenId,
        uint256 indexed projectId,
        bytes32 metadataHash
    );

    event ProjectStatusChanged(
        uint256 indexed projectId,
        ProjectStatus newStatus
    );

    event CollaboratorAdded(
        uint256 indexed projectId,
        uint256 indexed collaboratorTokenId
    );

    event SkillEndorsed(
        uint256 indexed tokenId,
        uint256 indexed endorserId,
        bytes32 indexed skillHash
    );

    event StandardSkillEndorsed(
        uint256 indexed subjectTokenId,
        uint256 indexed endorserTokenId,
        PredefinedSkill indexed skill
    );

    event SocialAccessGranted(
        uint256 indexed tokenId,
        address indexed viewer,
        uint8 sections
    );

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyTokenOwner(uint256 tokenId) {
        if (msg.sender != identity.ownerOf(tokenId)) revert NotTokenOwner();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _identityContract) Ownable(msg.sender) {
        identity = ISoulboundIdentity(_identityContract);
    }

    /*//////////////////////////////////////////////////////////////
                        ACCESS GRANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Grant a viewer access to specific social sections
    function grantSocialAccess(
        uint256 tokenId,
        address viewer,
        uint8 sections
    ) external onlyTokenOwner(tokenId) {
        grantedSections[tokenId][viewer] = sections;
        emit SocialAccessGranted(tokenId, viewer, sections);
    }

    /// @notice Grant multiple viewers the same social section access in one transaction
    /// @param tokenId The identity token ID
    /// @param viewers Array of addresses to grant access to
    /// @param sections Bitmask of sections to allow (0 = revoke all)
    function batchGrantSocialAccess(
        uint256 tokenId,
        address[] calldata viewers,
        uint8 sections
    ) external onlyTokenOwner(tokenId) {
        for (uint256 i = 0; i < viewers.length; ) {
            grantedSections[tokenId][viewers[i]] = sections;
            emit SocialAccessGranted(tokenId, viewers[i], sections);
            unchecked {
                ++i;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                        REPUTATION SYSTEM
    //////////////////////////////////////////////////////////////*/

    /// @notice Submit a review for another user
    function submitReview(
        uint256 subjectTokenId,
        uint256 reviewerTokenId,
        uint8 score,
        bool verified,
        bool isAnonymous,
        string calldata comment
    ) external onlyTokenOwner(reviewerTokenId) nonReentrant {
        if (subjectTokenId == reviewerTokenId) revert CannotReviewSelf();
        if (score > MAX_SCORE) revert InvalidScore();
        if (hasReviewedMap[reviewerTokenId][subjectTokenId])
            revert AlreadyReviewed();

        uint256 reviewId;
        unchecked {
            reviewId = ++_reviewIdCounter;
        }

        reviewsBySubject[subjectTokenId].push(
            Review({
                reviewId: reviewId,
                reviewerTokenId: reviewerTokenId,
                score: score,
                verified: verified,
                isAnonymous: isAnonymous,
                createdAt: uint64(block.timestamp),
                comment: comment
            })
        );

        hasReviewedMap[reviewerTokenId][subjectTokenId] = true;

        // Update cached totals
        unchecked {
            _runningScoreTotal[subjectTokenId] += score;
            _reviewCount[subjectTokenId]++;
            if (verified) _verifiedCount[subjectTokenId]++;
        }

        emit ReviewSubmitted(subjectTokenId, reviewerTokenId, reviewId, score);
    }

    /// @notice Get all reviews for a token
    function getReviews(
        uint256 tokenId
    ) external view returns (Review[] memory) {
        if (!_canAccessSection(tokenId, 0)) revert NoAccess();
        return reviewsBySubject[tokenId];
    }

    /// @notice Get reputation summary — O(1), uses cached totals
    function getReputationSummary(
        uint256 tokenId
    ) external view returns (ReputationSummary memory) {
        if (!_canAccessSection(tokenId, 0)) revert NoAccess();

        uint256 count = _reviewCount[tokenId];
        if (count == 0) return ReputationSummary(0, 0, 0);

        return
            ReputationSummary({
                averageScore: _runningScoreTotal[tokenId] / count,
                totalReviews: count,
                verifiedReviews: _verifiedCount[tokenId]
            });
    }

    /// @notice Check if one token has reviewed another
    function hasReviewed(
        uint256 reviewerTokenId,
        uint256 subjectTokenId
    ) external view returns (bool) {
        return hasReviewedMap[reviewerTokenId][subjectTokenId];
    }

    /*//////////////////////////////////////////////////////////////
                        PROJECT PORTFOLIO
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new project
    function createProject(
        uint256 tokenId,
        bytes32 metadataHash
    ) external onlyTokenOwner(tokenId) nonReentrant returns (uint256) {
        if (metadataHash == bytes32(0)) revert InvalidParameter();
        if (projectIdsByToken[tokenId].length >= MAX_PROJECTS) revert TooMany();

        uint256 projectId;
        unchecked {
            projectId = ++_projectIdCounter;
        }

        Project storage project = projects[tokenId][projectId];
        project.projectId = projectId;
        project.metadataHash = metadataHash;
        project.createdAt = uint64(block.timestamp);
        project.status = ProjectStatus.Planning;

        projectIdsByToken[tokenId].push(projectId);

        emit ProjectCreated(tokenId, projectId, metadataHash);

        return projectId;
    }

    /// @notice Update project status
    function updateProjectStatus(
        uint256 tokenId,
        uint256 projectId,
        ProjectStatus newStatus
    ) external onlyTokenOwner(tokenId) {
        Project storage project = projects[tokenId][projectId];
        if (project.projectId == 0) revert ProjectNotFound();

        project.status = newStatus;
        if (newStatus == ProjectStatus.Completed) {
            project.completedAt = uint64(block.timestamp);
        }

        emit ProjectStatusChanged(projectId, newStatus);
    }

    /// @notice Add collaborator to project
    function addCollaborator(
        uint256 tokenId,
        uint256 projectId,
        uint256 collaboratorTokenId
    ) external onlyTokenOwner(tokenId) {
        Project storage project = projects[tokenId][projectId];
        if (project.projectId == 0) revert ProjectNotFound();
        if (project.collaborators.length >= MAX_COLLABORATORS) revert TooMany();

        for (uint256 i = 0; i < project.collaborators.length; i++) {
            if (project.collaborators[i] == collaboratorTokenId)
                revert InvalidParameter();
        }

        project.collaborators.push(collaboratorTokenId);

        emit CollaboratorAdded(projectId, collaboratorTokenId);
    }

    /// @notice Get a specific project
    function getProject(
        uint256 tokenId,
        uint256 projectId
    ) external view returns (Project memory) {
        if (!_canAccessSection(tokenId, 1)) revert NoAccess();
        Project memory project = projects[tokenId][projectId];
        if (project.projectId == 0) revert ProjectNotFound();
        return project;
    }

    /// @notice Get all projects for a token
    function getProjects(
        uint256 tokenId
    ) external view returns (Project[] memory) {
        if (!_canAccessSection(tokenId, 1)) revert NoAccess();

        uint256[] memory projectIds = projectIdsByToken[tokenId];
        Project[] memory result = new Project[](projectIds.length);

        for (uint256 i = 0; i < projectIds.length; i++) {
            result[i] = projects[tokenId][projectIds[i]];
        }

        return result;
    }

    /// @notice Get project count by status
    function getProjectCountByStatus(
        uint256 tokenId,
        ProjectStatus status
    ) external view returns (uint256 count) {
        uint256[] memory projectIds = projectIdsByToken[tokenId];

        for (uint256 i = 0; i < projectIds.length; i++) {
            if (projects[tokenId][projectIds[i]].status == status) count++;
        }

        return count;
    }

    /*//////////////////////////////////////////////////////////////
                        SKILL ENDORSEMENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Endorse a skill
    function endorseSkill(
        uint256 subjectTokenId,
        uint256 endorserTokenId,
        bytes32 skillHash,
        string calldata comment
    ) external onlyTokenOwner(endorserTokenId) nonReentrant {
        if (subjectTokenId == endorserTokenId) revert CannotReviewSelf();
        if (skillHash == bytes32(0)) revert InvalidParameter();

        endorsementsByToken[subjectTokenId].push(
            Endorsement({
                endorserId: endorserTokenId,
                skillHash: skillHash,
                endorsedAt: uint64(block.timestamp),
                comment: comment
            })
        );

        endorsementCounts[subjectTokenId][skillHash]++;

        emit SkillEndorsed(subjectTokenId, endorserTokenId, skillHash);
    }

    /// @notice Get all endorsements for a token
    function getEndorsements(
        uint256 tokenId
    ) external view returns (Endorsement[] memory) {
        if (!_canAccessSection(tokenId, 2)) revert NoAccess();
        return endorsementsByToken[tokenId];
    }

    /// @notice Get endorsement count for a skill
    function getEndorsementCount(
        uint256 tokenId,
        bytes32 skillHash
    ) external view returns (uint256) {
        return endorsementCounts[tokenId][skillHash];
    }

    /// @notice Get endorsements for a specific skill
    function getSkillEndorsements(
        uint256 tokenId,
        bytes32 skillHash
    ) external view returns (Endorsement[] memory) {
        if (!_canAccessSection(tokenId, 2)) revert NoAccess();

        Endorsement[] memory all = endorsementsByToken[tokenId];

        uint256 matchCount = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].skillHash == skillHash) matchCount++;
        }

        Endorsement[] memory result = new Endorsement[](matchCount);
        uint256 index = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].skillHash == skillHash) {
                result[index] = all[i];
                index++;
            }
        }

        return result;
    }

    /*//////////////////////////////////////////////////////////////
                    STANDARDIZED SKILL ENDORSEMENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Endorse a predefined standardized skill (one endorsement per endorser per skill)
    /// @param subjectTokenId Token of the skill owner
    /// @param endorserTokenId Token of the endorser (caller must own this token)
    /// @param skill The predefined skill to endorse
    /// @param comment Optional short comment
    function endorseStandardSkill(
        uint256 subjectTokenId,
        uint256 endorserTokenId,
        PredefinedSkill skill,
        string calldata comment
    ) external onlyTokenOwner(endorserTokenId) nonReentrant {
        if (subjectTokenId == endorserTokenId) revert CannotReviewSelf();

        uint8 skillId = uint8(skill);
        if (_hasEndorsedStandardSkill[subjectTokenId][skillId][endorserTokenId])
            revert AlreadyEndorsedSkill();

        _hasEndorsedStandardSkill[subjectTokenId][skillId][endorserTokenId] = true;
        _standardSkillCount[subjectTokenId][skillId]++;

        endorsementsByToken[subjectTokenId].push(
            Endorsement({
                endorserId: endorserTokenId,
                skillHash: bytes32(uint256(skillId)),
                endorsedAt: uint64(block.timestamp),
                comment: comment
            })
        );
        endorsementCounts[subjectTokenId][bytes32(uint256(skillId))]++;

        emit StandardSkillEndorsed(subjectTokenId, endorserTokenId, skill);
    }

    /// @notice Get endorsement count for a specific predefined skill
    function getStandardSkillEndorsementCount(
        uint256 tokenId,
        PredefinedSkill skill
    ) external view returns (uint256) {
        return _standardSkillCount[tokenId][uint8(skill)];
    }

    /// @notice Get all 16 predefined skill endorsement counts for a token
    /// @return counts Array indexed by PredefinedSkill (length = PREDEFINED_SKILL_COUNT)
    function getAllStandardSkillCounts(
        uint256 tokenId
    ) external view returns (uint256[16] memory counts) {
        for (uint8 i = 0; i < PREDEFINED_SKILL_COUNT; ) {
            counts[i] = _standardSkillCount[tokenId][i];
            unchecked { ++i; }
        }
    }

    /// @notice Get endorsement counts for all skills within a category
    /// @return skillIds The skill enum IDs in the requested category
    /// @return counts Endorsement counts matching skillIds
    function getSkillCountsByCategory(
        uint256 tokenId,
        SkillCategory category
    ) external view returns (uint8[] memory skillIds, uint256[] memory counts) {
        uint8 start;
        uint8 end;
        if (category == SkillCategory.Technical) { start = 0;  end = 6;  }
        else if (category == SkillCategory.Business)  { start = 6;  end = 11; }
        else if (category == SkillCategory.Creative)  { start = 11; end = 14; }
        else                                          { start = 14; end = 16; }

        uint8 size = end - start;
        skillIds = new uint8[](size);
        counts   = new uint256[](size);

        for (uint8 i = 0; i < size; ) {
            skillIds[i] = start + i;
            counts[i]   = _standardSkillCount[tokenId][start + i];
            unchecked { ++i; }
        }
    }

    /// @notice Return the category a predefined skill belongs to
    function getSkillCategory(PredefinedSkill skill) external pure returns (SkillCategory) {
        uint8 id = uint8(skill);
        if (id <= 5)  return SkillCategory.Technical;
        if (id <= 10) return SkillCategory.Business;
        if (id <= 13) return SkillCategory.Creative;
        return SkillCategory.Soft;
    }

    /// @notice Check whether an endorser has already endorsed a skill for a subject
    function hasEndorsedStandardSkill(
        uint256 subjectTokenId,
        PredefinedSkill skill,
        uint256 endorserTokenId
    ) external view returns (bool) {
        return _hasEndorsedStandardSkill[subjectTokenId][uint8(skill)][endorserTokenId];
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if caller can access a specific section for a token
    /// @param tokenId The token ID
    /// @param bit Section bit position (0=Reviews, 1=Projects, 2=Endorsements)
    function _canAccessSection(
        uint256 tokenId,
        uint8 bit
    ) internal view returns (bool) {
        if (msg.sender == identity.ownerOf(tokenId)) return true;
        return (grantedSections[tokenId][msg.sender] >> bit) & 1 == 1;
    }
}

