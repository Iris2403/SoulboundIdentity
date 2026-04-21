// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[1] calldata _pubSignals
    ) external view returns (bool);
}

// Stores the highest ZK-proven reputation threshold for each token.
// Anyone can submit a valid proof for any token; the verifier ensures it is genuine.
contract ReputationProofRegistry {
    IGroth16Verifier public immutable verifier;

    // tokenId => highest threshold the owner has proven their score exceeds
    mapping(uint256 => uint256) public provenThreshold;

    event ProofRecorded(uint256 indexed tokenId, uint256 threshold);

    constructor(address _verifier) {
        verifier = IGroth16Verifier(_verifier);
    }

    function recordProof(
        uint256 tokenId,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[1] calldata _pubSignals
    ) external {
        require(verifier.verifyProof(_pA, _pB, _pC, _pubSignals), "Invalid proof");
        uint256 threshold = _pubSignals[0];
        if (threshold > provenThreshold[tokenId]) {
            provenThreshold[tokenId] = threshold;
            emit ProofRecorded(tokenId, threshold);
        }
    }
}
