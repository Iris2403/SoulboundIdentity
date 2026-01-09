// Contract ABIs - declared globally
SOULBOUND_IDENTITY_ABI = [
    "function mint(string calldata ipfsCID, uint8 burnAuth) external returns (uint256)",
    "function tokensOfOwner(address owner) external view returns (uint256[] memory)",
    "function getMetadata(uint256 tokenId) external view returns (string memory)",
    "function requestAccess(uint256 tokenId) external",
    "function approveAccess(uint256 tokenId, address requester, uint64 duration) external",
    "function denyAccess(uint256 tokenId, address requester) external",
    "function revokeAccess(uint256 tokenId, address requester, string calldata reason) external",
    "function canView(uint256 tokenId, address viewer) external view returns (bool)",
    "function checkAccess(uint256 tokenId, address requester) external view returns (bool hasAccess, uint64 expiresAt)",
    "function getPendingRequests(uint256 tokenId, uint256 offset, uint256 limit) external view returns (address[] memory requesters, uint256 totalCount)",
    "function getAccessStatus(uint256 tokenId, address requester) external view returns (uint8 status)",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function getOwnedTokensPaginated(address owner, uint256 offset, uint256 limit) external view returns (uint256[] memory tokenIds, string[] memory metadataCIDs, uint256 totalCount)",
    "function MAX_REQUESTS_PER_DAY() external view returns (uint256)",
    "function owner() external view returns (address)",
    "error OnlyTokenOwner()",
    "error OwnerHasAccess()",
    "error TooManyRequests()",
    "error RequestCooldown(uint256 timeRemaining)",
    "error InvalidIPFSCID()",
    "error InvalidAddress()",
    "error NoAccessRequest()",
    "error RequestAlreadyExists()",
    "error InvalidDuration()",
    "event Minted(address indexed to, uint256 indexed tokenId, string ipfsCID, uint8 burnAuth)",
    "event AccessRequested(uint256 indexed tokenId, address indexed requester)",
    "event AccessApproved(uint256 indexed tokenId, address indexed requester, uint64 duration)",
    "event AccessDenied(uint256 indexed tokenId, address indexed requester)",
    "event AccessRevoked(uint256 indexed tokenId, address indexed requester, string reason)"
];

CREDENTIALS_HUB_ABI = [
    "function issueCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
    "function addCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
    "function revokeCredential(uint256 tokenId, uint256 credentialId) external",
    "function setIssuerAuthorization(uint8 credType, address issuer, bool authorized) external",
    "function batchAuthorizeIssuers(uint8 credType, address[] calldata issuers, bool authorized) external",
    "function getCredential(uint256 tokenId, uint256 credentialId) external view returns (tuple(uint256 credentialId, uint8 credType, bytes32 metadataHash, address issuer, uint64 issueDate, uint64 expiryDate, uint8 status, uint8 category, bool verified))",
    "function getCredentialsByType(uint256 tokenId, uint8 credType) external view returns (tuple(uint256 credentialId, uint8 credType, bytes32 metadataHash, address issuer, uint64 issueDate, uint64 expiryDate, uint8 status, uint8 category, bool verified)[] memory)",
    "function getActiveCredentials(uint256 tokenId, uint8 credType) external view returns (tuple(uint256 credentialId, uint8 credType, bytes32 metadataHash, address issuer, uint64 issueDate, uint64 expiryDate, uint8 status, uint8 category, bool verified)[] memory)",
    "function getCredentialSummary(uint256 tokenId) external view returns (uint256 degrees, uint256 certifications, uint256 workExperience, uint256 identityProofs, uint256 skills)",
    "function isCredentialValid(uint256 tokenId, uint256 credentialId) external view returns (bool)",
    "function authorizedIssuers(uint8 credType, address issuer) external view returns (bool)",
    "error NotTokenOwner()",
    "error NotAuthorizedIssuer()",
    "error CredentialNotFound()",
    "error InvalidDates()",
    "error NoAccess()",
    "error TooManyCredentials()",
    "event CredentialIssued(uint256 indexed tokenId, uint256 indexed credentialId, uint8 indexed credType, address issuer)",
    "event CredentialRevoked(uint256 indexed credentialId, address indexed revoker)",
    "event IssuerAuthorized(uint8 indexed credType, address indexed issuer, bool authorized)"
];

SOCIAL_HUB_ABI = [
    "function submitReview(uint256 subjectTokenId, uint256 reviewerTokenId, uint8 score, bool verified, bool isAnonymous, string calldata comment) external",
    "function createProject(uint256 tokenId, bytes32 metadataHash) external returns (uint256)",
    "function updateProjectStatus(uint256 tokenId, uint256 projectId, uint8 newStatus) external",
    "function addCollaborator(uint256 tokenId, uint256 projectId, uint256 collaboratorTokenId) external",
    "function endorseSkill(uint256 subjectTokenId, uint256 endorserTokenId, bytes32 skillHash, string calldata comment) external",
    "function getReviews(uint256 tokenId) external view returns (tuple(uint256 reviewId, uint256 reviewerTokenId, uint8 score, bool verified, bool isAnonymous, uint64 createdAt, string comment)[] memory)",
    "function getReputationSummary(uint256 tokenId) external view returns (tuple(uint256 averageScore, uint256 totalReviews, uint256 verifiedReviews) memory)",
    "function getProjects(uint256 tokenId) external view returns (tuple(uint256 projectId, bytes32 metadataHash, uint64 createdAt, uint64 completedAt, uint8 status, uint256[] collaborators)[] memory)",
    "function getEndorsements(uint256 tokenId) external view returns (tuple(uint256 endorserId, bytes32 skillHash, uint64 endorsedAt, string comment)[] memory)",
    "function hasReviewed(uint256 reviewerTokenId, uint256 subjectTokenId) external view returns (bool)",
    "function getProjectCountByStatus(uint256 tokenId, uint8 status) external view returns (uint256)",
    "error CannotReviewSelf()",
    "error AlreadyReviewed()",
    "error ProjectNotFound()",
    "error NotProjectOwner()",
    "error InvalidScore()",
    "error NoAccess()",
    "event ReviewSubmitted(uint256 indexed subjectTokenId, uint256 indexed reviewerTokenId, uint256 indexed reviewId, uint8 score)",
    "event ProjectCreated(uint256 indexed tokenId, uint256 indexed projectId, bytes32 metadataHash)",
    "event SkillEndorsed(uint256 indexed tokenId, uint256 indexed endorserId, bytes32 indexed skillHash)"
];

// Configuration
CONFIG = {
    RPC_URL: 'https://rpc.dimikog.org/rpc/',
    CHAIN_ID: 424242,
    CHAIN_ID_HEX: '0x67932',
    NETWORK_NAME: 'QBFT_Besu_EduNet',
    CONTRACTS: {
        SOULBOUND_IDENTITY: '0xf1FB393025ef07673CcFBD5E83E07f6cF503F8ee',
        CREDENTIALS_HUB: '0x25154346a75204f80108E73739f0A4AaD4754c8B',
        SOCIAL_HUB: '0xbe78D2f3c24Abdd91AD8263D7cF10290F94045a7'
    },
    IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
    BLOCK_EXPLORER: 'https://explorer.dimikog.org'
};

console.log('✅ Contracts and config loaded globally');
