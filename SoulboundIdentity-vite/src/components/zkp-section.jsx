import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card, Button, Input } from './ui';

export function ZKPSection({ contracts, selectedToken, showNotification }) {
    const [wasmBuffer, setWasmBuffer] = useState(null);
    const [zkeyBuffer, setZkeyBuffer] = useState(null);
    const [wasmName, setWasmName] = useState('');
    const [zkeyName, setZkeyName] = useState('');
    const [setupScore, setSetupScore] = useState('75');
    const [setupSalt, setSetupSalt] = useState('');
    const [setupCommitment, setSetupCommitment] = useState('');
    const [settingCommitment, setSettingCommitment] = useState(false);
    const [storedCommitment, setStoredCommitment] = useState(null);
    const [proveScore, setProveScore] = useState('75');
    const [proveSalt, setProveSalt] = useState('');
    const [proveThreshold, setProveThreshold] = useState('70');
    const [proving, setProving] = useState(false);
    const [lastProof, setLastProof] = useState(null);
    const [showHowTo, setShowHowTo] = useState(false);

    useEffect(() => {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        const salt = BigInt('0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')).toString();
        setSetupSalt(salt);
        setProveSalt(salt);
    }, []);

    useEffect(() => {
        if (selectedToken && contracts?.social) loadStoredCommitment();
    }, [selectedToken, contracts]);

    const loadStoredCommitment = async () => {
        try {
            const c = await contracts.social.reputationCommitment(selectedToken);
            setStoredCommitment(c === ethers.constants.HashZero ? null : c);
        } catch (e) {
            console.error('Failed to load commitment', e);
        }
    };

    const generateRandomSalt = () => {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        const salt = BigInt('0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')).toString();
        setSetupSalt(salt);
    };

    const handleWasmLoad = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setWasmName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => setWasmBuffer(ev.target.result);
        reader.readAsArrayBuffer(file);
    };

    const handleZkeyLoad = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setZkeyName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => setZkeyBuffer(ev.target.result);
        reader.readAsArrayBuffer(file);
    };

    const handleSetCommitment = async () => {
        if (!setupCommitment) { showNotification('Please enter your commitment value', 'error'); return; }
        setSettingCommitment(true);
        try {
            const commitmentBytes32 = ethers.utils.hexZeroPad(ethers.BigNumber.from(setupCommitment).toHexString(), 32);
            const tx = await contracts.social.setReputationCommitment(selectedToken, commitmentBytes32);
            showNotification('Setting commitment on-chain...', 'info');
            await tx.wait();
            showNotification('Commitment set successfully!', 'success');
            await loadStoredCommitment();
        } catch (e) {
            console.error('Set commitment failed', e);
            showNotification('Failed: ' + (e.reason || e.message), 'error');
        } finally {
            setSettingCommitment(false);
        }
    };

    const handleGenerateAndProve = async () => {
        if (!wasmBuffer || !zkeyBuffer) { showNotification('Please load the .wasm and .zkey files', 'error'); return; }
        if (!storedCommitment) { showNotification('No commitment on-chain. Complete Step 1 first.', 'error'); return; }
        if (!proveScore || !proveSalt || !proveThreshold) { showNotification('Please fill in score, salt, and threshold', 'error'); return; }
        if (typeof snarkjs === 'undefined') { showNotification('snarkjs not loaded. Check your internet connection.', 'error'); return; }
        setProving(true);
        setLastProof(null);
        try {
            const commitmentBigInt = ethers.BigNumber.from(storedCommitment).toString();
            const input = { score: proveScore, salt: proveSalt, commitment: commitmentBigInt, threshold: proveThreshold };
            showNotification('Generating ZK proof — this may take 30–60 seconds...', 'info');
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, new Uint8Array(wasmBuffer), new Uint8Array(zkeyBuffer));
            showNotification('Proof generated! Submitting on-chain...', 'info');
            const pA = [proof.pi_a[0], proof.pi_a[1]];
            const pB = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
            const pC = [proof.pi_c[0], proof.pi_c[1]];
            const pubSigs = [publicSignals[0], publicSignals[1]];
            const tx = await contracts.verifier.proveReputation(selectedToken, proveThreshold, pA, pB, pC, pubSigs);
            await tx.wait();
            setLastProof({ publicSignals, threshold: proveThreshold });
            showNotification(`Proved on-chain: score >= ${proveThreshold}`, 'success');
        } catch (e) {
            console.error('Proof failed', e);
            const msg = e.message || '';
            if (msg.includes('Assert') || msg.includes('constraint') || msg.includes('witness')) {
                showNotification('Proof failed: score/salt do not match your stored commitment.', 'error');
            } else {
                showNotification('Failed: ' + (e.reason || msg), 'error');
            }
        } finally {
            setProving(false);
        }
    };

    const filesReady = wasmBuffer && zkeyBuffer;
    const filePickerStyle = (loaded) => ({
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
        border: `1px dashed ${loaded ? 'var(--success)' : 'rgba(255,255,255,0.2)'}`,
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
        color: loaded ? 'var(--success)' : 'var(--text-muted)',
        background: loaded ? 'rgba(34,197,94,0.05)' : 'transparent'
    });

    return (
        <div style={{ marginTop: '32px' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.08))', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ color: '#a78bfa', marginBottom: '8px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>🔐 Zero-Knowledge Reputation Proof</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>Prove your reputation score meets a threshold — without revealing the actual score. Uses a Groth16 + Poseidon circuit deployed on-chain.</p>
                <div style={{ marginTop: '16px', padding: '10px 16px', borderRadius: '8px', background: storedCommitment ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${storedCommitment ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>{storedCommitment ? '✅' : '⚠️'}</span>
                    <span style={{ color: storedCommitment ? 'var(--success)' : 'var(--warning)', fontFamily: storedCommitment ? 'monospace' : 'inherit' }}>
                        {storedCommitment ? `Commitment: ${storedCommitment.slice(0, 12)}...${storedCommitment.slice(-8)}` : 'No commitment set — complete Step 1 before generating proofs'}
                    </span>
                </div>
            </div>

            <Card style={{ marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--teal-light)', marginBottom: '4px', fontSize: '16px' }}>Step 1 — Set Your Commitment</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                    Compute <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>Poseidon(score, salt)</code> locally, then store that commitment on-chain. Your actual score stays secret.
                </p>
                <button onClick={() => setShowHowTo(p => !p)} style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '8px', color: 'var(--teal-light)', cursor: 'pointer', fontSize: '13px', padding: '8px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {showHowTo ? '▲' : '▼'} How to compute the commitment
                </button>
                {showHowTo && (
                    <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontFamily: 'monospace', fontSize: '12px', color: '#86efac', lineHeight: '1.8', overflowX: 'auto' }}>
                        <div style={{ color: '#94a3b8', marginBottom: '8px' }}># In your ZK-SBT project folder:</div>
                        <div>node -e &quot;<br />
                        {'  '}const {'{'} buildPoseidon {'}'} = require(&apos;circomlibjs&apos;);<br />
                        {'  '}buildPoseidon().then(p =&gt; {'{'}<br />
                        {'    '}const h = p([BigInt(YOUR_SCORE), BigInt(YOUR_SALT)]);<br />
                        {'    '}console.log(p.F.toString(h));<br />
                        {'  '}{'}'});<br />
                        &quot;</div>
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Input label="Score (0–100)" value={setupScore} onChange={setSetupScore} type="number" placeholder="e.g. 75" />
                    <div>
                        <Input label="Salt  (keep this secret — you'll need it again to prove)" value={setupSalt} onChange={setSetupSalt} placeholder="Large random number" />
                        <button onClick={generateRandomSalt} style={{ marginTop: '6px', background: 'none', border: 'none', color: 'var(--teal-light)', cursor: 'pointer', fontSize: '12px', padding: '0' }}>↻ Generate new random salt</button>
                    </div>
                    <Input label="Commitment (paste output from the node command above)" value={setupCommitment} onChange={setSetupCommitment} placeholder="e.g. 9685073299441218135538749186372451095178..." />
                    <Button onClick={handleSetCommitment} disabled={settingCommitment || !setupCommitment}>
                        {settingCommitment ? 'Setting...' : 'Set Commitment On-Chain'}
                    </Button>
                </div>
            </Card>

            <Card>
                <h4 style={{ color: 'var(--teal-light)', marginBottom: '4px', fontSize: '16px' }}>Step 2 — Generate & Submit Proof</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                    Load the circuit files from your ZK-SBT project (<code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>keys/reputation.wasm</code> and <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>keys/reputation_final.zkey</code>), then prove your score meets the threshold without revealing it.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Circuit WASM <span style={{ color: 'var(--text-muted)' }}>(reputation.wasm)</span></div>
                        <label style={filePickerStyle(!!wasmBuffer)}>
                            <input type="file" accept=".wasm" onChange={handleWasmLoad} style={{ display: 'none' }} />
                            {wasmBuffer ? `✅ ${wasmName}` : '📂 Load .wasm file'}
                        </label>
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Proving key <span style={{ color: 'var(--text-muted)' }}>(reputation_final.zkey)</span></div>
                        <label style={filePickerStyle(!!zkeyBuffer)}>
                            <input type="file" accept=".zkey" onChange={handleZkeyLoad} style={{ display: 'none' }} />
                            {zkeyBuffer ? `✅ ${zkeyName}` : '📂 Load .zkey file'}
                        </label>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Input label="Your Score (must match what you committed)" value={proveScore} onChange={setProveScore} type="number" placeholder="e.g. 75" />
                    <Input label="Your Salt (same one from Step 1)" value={proveSalt} onChange={setProveSalt} placeholder="Same salt used to set commitment" />
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Threshold — prove score &gt;=</label>
                        <input className="input-field" type="range" min="0" max="100" value={proveThreshold} onChange={e => setProveThreshold(e.target.value)} />
                        <div style={{ textAlign: 'center', color: 'var(--teal-light)', fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>Score &gt;= {proveThreshold}</div>
                    </div>
                    <Button onClick={handleGenerateAndProve} disabled={proving || !filesReady || !storedCommitment} style={{ background: proving ? undefined : 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                        {proving ? '⏳ Generating proof...' : !filesReady ? 'Load circuit files first' : !storedCommitment ? 'Set commitment first (Step 1)' : '🔐 Generate & Submit Proof'}
                    </Button>
                    {proving && (
                        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', padding: '12px', background: 'rgba(124,58,237,0.08)', borderRadius: '8px' }}>
                            ZK proof generation runs in your browser. This typically takes 30–60 seconds.
                        </div>
                    )}
                    {lastProof && (
                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: '20px' }}>
                            <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '8px', fontSize: '16px' }}>✅ Proof verified on-chain!</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Successfully proved: score &gt;= {lastProof.threshold}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                                Public signals: [{lastProof.publicSignals[0].slice(0, 14)}..., {lastProof.publicSignals[1]}]
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
