import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONFIG, SOULBOUND_IDENTITY_ABI, CREDENTIALS_HUB_ABI, SOCIAL_HUB_ABI, REPUTATION_VERIFIER_ABI } from '../contracts';
import { credentialTypes, shortenAddress } from '../utils';
import { useToast } from './toast';
import { TransactionStatus } from './ui';
import { Header } from './header';
import { WelcomeScreen } from './welcome';
import { TabNavigation } from './navigation';
import { IdentityTab } from './identity-tab';
import { CredentialsTab } from './credentials-tab';
import { AccessControlTab } from './access-control-tab';
import { SocialTab } from './social-tab';
import { AnalyticsTab } from './analytics-tab';
import { ViewIdentitiesTab } from './view-identities-tab';

export function App() {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contracts, setContracts] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('identity');
    const [userTokens, setUserTokens] = useState([]);
    const [selectedToken, setSelectedToken] = useState(null);
    const [pendingTxs, setPendingTxs] = useState([]);
    const [gasEstimate, setGasEstimate] = useState(null);

    const { addToast } = useToast();

    const showNotification = useCallback((message, type = 'info') => {
        addToast(message, type);
    }, [addToast]);

    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                showNotification('Please install MetaMask!', 'error');
                return;
            }
            setLoading(true);
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const account = accounts[0];
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (parseInt(chainId, 16) !== CONFIG.CHAIN_ID) {
                try {
                    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}` }] });
                } catch (switchError) {
                    if (switchError.code === 4902) {
                        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}`, chainName: CONFIG.NETWORK_NAME, rpcUrls: [CONFIG.RPC_URL] }] });
                    }
                }
            }
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const web3Signer = web3Provider.getSigner();
            setAccount(account);
            setProvider(web3Provider);
            setSigner(web3Signer);
            const soulboundContract = new ethers.Contract(CONFIG.CONTRACTS.SOULBOUND_IDENTITY, SOULBOUND_IDENTITY_ABI, web3Signer);
            const credentialsContract = new ethers.Contract(CONFIG.CONTRACTS.CREDENTIALS_HUB, CREDENTIALS_HUB_ABI, web3Signer);
            const socialContract = new ethers.Contract(CONFIG.CONTRACTS.SOCIAL_HUB, SOCIAL_HUB_ABI, web3Signer);
            const verifierContract = new ethers.Contract(CONFIG.CONTRACTS.REPUTATION_VERIFIER, REPUTATION_VERIFIER_ABI, web3Signer);
            setContracts({ soulbound: soulboundContract, credentials: credentialsContract, social: socialContract, verifier: verifierContract });
            await loadUserTokens(soulboundContract, account);
            showNotification('Wallet connected successfully!', 'success');
            setLoading(false);
        } catch (error) {
            console.error('Error connecting wallet:', error);
            showNotification('Failed to connect wallet', 'error');
            setLoading(false);
        }
    };

    const loadUserTokens = async (contract, addr) => {
        try {
            const result = await contract.getOwnedTokensPaginated(addr, 0, 100);
            const tokenData = result.tokenIds.map((tokenId, index) => ({ id: tokenId.toNumber(), cid: result.metadataCIDs[index] }));
            setUserTokens(tokenData);
            setSelectedToken(tokenData.length > 0 ? tokenData[0].id : null);
        } catch (error) {
            console.error('Error loading tokens:', error);
            showNotification('Failed to load tokens', 'error');
        }
    };

    const trackTransaction = useCallback(async (tx, description) => {
        const txId = Date.now();
        setPendingTxs(prev => [...prev, { id: txId, hash: tx.hash, description, status: 'pending' }]);
        try {
            const receipt = await tx.wait();
            setPendingTxs(prev => prev.map(t => t.id === txId ? { ...t, status: 'confirmed', receipt } : t));
            addToast(`${description} confirmed!`, 'success');
            return receipt;
        } catch (error) {
            setPendingTxs(prev => prev.map(t => t.id === txId ? { ...t, status: 'failed', error: error.message } : t));
            handleError(error, description);
            throw error;
        }
    }, [addToast]);

    const handleError = useCallback((error, context) => {
        console.error(`Error in ${context}:`, error);
        let message = 'Transaction failed';
        if (error.code === 'ACTION_REJECTED') message = 'Transaction rejected by user';
        else if (error.code === 'INSUFFICIENT_FUNDS') message = 'Insufficient funds for transaction';
        else if (error.message?.includes('execution reverted')) message = error.message.match(/reason="(.+?)"/)?.[1] || 'Contract execution reverted';
        else if (error.message?.includes('nonce')) message = 'Nonce too low - please reset your MetaMask account';
        else if (error.message) message = error.message;
        addToast(message, 'error');
    }, [addToast]);

    const estimateGas = useCallback(async (contractMethod, ...args) => {
        try {
            const estimate = await contractMethod.estimateGas(...args);
            const gasPrice = await provider.getGasPrice();
            const costInWei = estimate.mul(gasPrice);
            const costInEth = ethers.utils.formatEther(costInWei);
            setGasEstimate({ gasLimit: estimate.toString(), gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'), estimatedCost: costInEth });
        } catch (error) {
            console.error('Gas estimation failed:', error);
            setGasEstimate(null);
        }
    }, [provider]);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) { setAccount(null); setContracts(null); }
                else connectWallet();
            });
            window.ethereum.on('chainChanged', () => { window.location.reload(); });
        }
    }, []);

    useEffect(() => {
        if (!contracts || !selectedToken) return;
        const { soulbound, credentials, social } = contracts;
        const tokenId = selectedToken;

        const handleMinted = (to, tid, ipfsCID, burnAuth) => {
            console.log('🎉 Token Minted!', { to, tokenId: tid.toString(), ipfsCID });
            addToast(`Token #${tid} minted successfully!`, 'success');
            if (soulbound) loadUserTokens(soulbound, account);
        };
        const handleAccessRequested = (tid, requester) => {
            console.log('🔔 Access Requested', { tokenId: tid.toString(), requester });
            addToast(`New access request from ${shortenAddress(requester)}`, 'info');
        };
        const handleAccessApproved = (tid, requester, expiresAt) => {
            console.log('✅ Access Approved', { tokenId: tid.toString(), requester });
            addToast(`Access approved for ${shortenAddress(requester)}`, 'success');
        };
        const handleAccessRevoked = (tid, requester, reason) => {
            console.log('❌ Access Revoked', { tokenId: tid.toString(), requester, reason });
            addToast(`Access revoked: ${reason}`, 'warning');
        };
        const handleCredentialIssued = (tid, credentialId, credType, issuer) => {
            console.log('📜 Credential Issued', { tokenId: tid.toString(), credentialId: credentialId.toString(), credType });
            const credTypeName = credentialTypes[credType] || 'Unknown';
            addToast(`New ${credTypeName} credential issued!`, 'success');
        };
        const handleCredentialRevoked = (tid, credentialId) => {
            console.log('🚫 Credential Revoked', { tokenId: tid.toString(), credentialId: credentialId.toString() });
            addToast(`Credential #${credentialId} revoked`, 'warning');
        };
        const handleReviewSubmitted = (subjectTokenId, reviewerTokenId, reviewId, score) => {
            console.log('⭐ Review Submitted', { subjectTokenId: subjectTokenId.toString(), reviewId: reviewId.toString(), score });
            addToast(`New review received (${score}/100)`, 'success');
        };
        const handleProjectCreated = (tid, projectId) => {
            console.log('🚀 Project Created', { tokenId: tid.toString(), projectId: projectId.toString() });
            addToast(`Project #${projectId} created!`, 'success');
        };
        const handleSkillEndorsed = (subjectTokenId, endorserTokenId, skillHash) => {
            console.log('👍 Skill Endorsed', { subjectTokenId: subjectTokenId.toString(), endorserTokenId: endorserTokenId.toString() });
            addToast(`New skill endorsement received!`, 'success');
        };

        const mintedFilter = soulbound.filters.Minted(account, null);
        soulbound.on(mintedFilter, handleMinted);
        const accessRequestedFilter = soulbound.filters.AccessRequested(tokenId);
        const accessApprovedFilter = soulbound.filters.AccessApproved(tokenId);
        const accessRevokedFilter = soulbound.filters.AccessRevoked(tokenId);
        soulbound.on(accessRequestedFilter, handleAccessRequested);
        soulbound.on(accessApprovedFilter, handleAccessApproved);
        soulbound.on(accessRevokedFilter, handleAccessRevoked);
        const credentialIssuedFilter = credentials.filters.CredentialIssued(tokenId);
        const credentialRevokedFilter = credentials.filters.CredentialRevoked();
        credentials.on(credentialIssuedFilter, handleCredentialIssued);
        credentials.on(credentialRevokedFilter, handleCredentialRevoked);
        const reviewFilter = social.filters.ReviewSubmitted(tokenId);
        const projectFilter = social.filters.ProjectCreated(tokenId);
        const endorseFilter = social.filters.SkillEndorsed(tokenId);
        social.on(reviewFilter, handleReviewSubmitted);
        social.on(projectFilter, handleProjectCreated);
        social.on(endorseFilter, handleSkillEndorsed);

        return () => {
            soulbound.removeAllListeners();
            credentials.removeAllListeners();
            social.removeAllListeners();
        };
    }, [contracts, selectedToken, account, addToast]);

    return (
        <div className="app-container">
            <TransactionStatus pendingTxs={pendingTxs} />
            <Header account={account} onConnect={connectWallet} loading={loading} />
            {!account ? (
                <WelcomeScreen onConnect={connectWallet} loading={loading} />
            ) : (
                <>
                    <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} userTokens={userTokens} />
                    <main className="main-content">
                        {activeTab === 'identity' && (
                            <IdentityTab contracts={contracts} account={account} userTokens={userTokens} selectedToken={selectedToken} setSelectedToken={setSelectedToken} onTokenCreated={() => loadUserTokens(contracts.soulbound, account)} showNotification={showNotification} />
                        )}
                        {activeTab === 'credentials' && (
                            <CredentialsTab contracts={contracts} selectedToken={selectedToken} userTokens={userTokens} showNotification={showNotification} />
                        )}
                        {activeTab === 'access' && (
                            <AccessControlTab contracts={contracts} selectedToken={selectedToken} userTokens={userTokens} showNotification={showNotification} />
                        )}
                        {activeTab === 'social' && (
                            <SocialTab contracts={contracts} selectedToken={selectedToken} userTokens={userTokens} account={account} showNotification={showNotification} />
                        )}
                        {activeTab === 'analytics' && (
                            <AnalyticsTab contracts={contracts} selectedToken={selectedToken} showNotification={showNotification} />
                        )}
                        {activeTab === 'events' && (
                            <ViewIdentitiesTab contracts={contracts} account={account} showNotification={showNotification} />
                        )}
                    </main>
                </>
            )}
        </div>
    );
}
