ProjectsSection = function ({ projects, collaboratingOn, loading, contracts, selectedToken, showNotification, onReload, MAX_PROJECTS, MAX_COLLABORATORS }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCollabModal, setShowCollabModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectData, setProjectData] = useState({
        title: '',
        description: '',
        url: ''
    });
    const [collabData, setCollabData] = useState('');

    // Calculate total projects across all statuses
    const totalProjects = projects?.length || 0;
    const isNearLimit = totalProjects >= MAX_PROJECTS * 0.9;

    const handleCreateProject = async () => {
        try {
            if (!projectData.title) {
                showNotification('Please enter a project title', 'error');
                return;
            }

            if (!selectedToken) {
                showNotification('Please select a token first', 'error');
                return;
            }

            // NEW: Check project limit
            if (totalProjects >= MAX_PROJECTS) {
                showNotification(`❌ Maximum project limit reached (${MAX_PROJECTS} projects)`, 'error');
                return;
            }

            // Validation: Check if you own the selected token
            try {
                const owner = await contracts.soulbound.ownerOf(selectedToken);
                const myAddress = await contracts.soulbound.signer.getAddress();
                if (owner.toLowerCase() !== myAddress.toLowerCase()) {
                    showNotification(`You don't own Token #${selectedToken}!`, 'error');
                    return;
                }
            } catch (err) {
                showNotification(`Token #${selectedToken} does not exist!`, 'error');
                return;
            }

            // Create metadata hash
            const metadata = {
                title: projectData.title,
                description: projectData.description,
                url: projectData.url,
                createdAt: Date.now()
            };
            const metadataHash = ethers.utils.id(JSON.stringify(metadata));

            const tx = await contracts.social.createProject(selectedToken, metadataHash);
            showNotification('Creating project...', 'info');
            await tx.wait();
            showNotification('Project created successfully!', 'success');
            setShowCreateModal(false);
            setProjectData({ title: '', description: '', url: '' });
            onReload();
        } catch (error) {
            console.error('Error creating project:', error);

            if (error.message.includes('TooManyProjects')) {
                showNotification(`❌ Maximum project limit reached (${MAX_PROJECTS} projects)`, 'error');
            } else {
                showNotification(error.message || 'Failed to create project', 'error');
            }
        }
    };

    const handleUpdateStatus = async (projectId, newStatus) => {
        try {
            const tx = await contracts.social.updateProjectStatus(selectedToken, projectId, newStatus);
            showNotification('Updating project status...', 'info');
            await tx.wait();
            showNotification('Project status updated!', 'success');
            onReload();
        } catch (error) {
            console.error('Error updating status:', error);
            showNotification(error.message || 'Failed to update status', 'error');
        }
    };

    const handleAddCollaborator = async () => {
        try {
            if (!collabData || !selectedProject) {
                showNotification('Please enter a collaborator token ID', 'error');
                return;
            }

            const collabTokenId = parseInt(collabData);

            // NEW: Check collaborator limit
            const currentCollabCount = selectedProject.collaborators?.length || 0;
            if (currentCollabCount >= MAX_COLLABORATORS) {
                showNotification(`❌ Maximum collaborator limit reached (${MAX_COLLABORATORS} per project)`, 'error');
                return;
            }

            // Validation: Check if collaborator token exists
            try {
                await contracts.soulbound.ownerOf(collabTokenId);
            } catch (err) {
                showNotification(`Token #${collabTokenId} does not exist!`, 'error');
                return;
            }

            // Validation: Check if you own the selected token (project owner)
            try {
                const owner = await contracts.soulbound.ownerOf(selectedToken);
                const myAddress = await contracts.soulbound.signer.getAddress();
                if (owner.toLowerCase() !== myAddress.toLowerCase()) {
                    showNotification(`You don't own Token #${selectedToken}!`, 'error');
                    return;
                }
            } catch (err) {
                showNotification(`Token #${selectedToken} does not exist!`, 'error');
                return;
            }

            const tx = await contracts.social.addCollaborator(
                selectedToken,
                selectedProject.projectId,
                collabTokenId
            );
            showNotification('Adding collaborator...', 'info');
            await tx.wait();

            // Track this collaboration for the collaborator
            const storedCollabs = JSON.parse(localStorage.getItem(`collaborations_${collabTokenId}`) || '[]');
            storedCollabs.push({
                ownerTokenId: selectedToken,
                projectId: selectedProject.projectId.toString(),
                addedAt: Date.now()
            });
            localStorage.setItem(`collaborations_${collabTokenId}`, JSON.stringify(storedCollabs));

            showNotification('Collaborator added successfully!', 'success');
            setShowCollabModal(false);
            setCollabData('');
            setSelectedProject(null);
            onReload();
        } catch (error) {
            console.error('Error adding collaborator:', error);

            if (error.message.includes('TooManyCollaborators')) {
                showNotification(`❌ Maximum collaborator limit reached (${MAX_COLLABORATORS} per project)`, 'error');
            } else {
                showNotification(error.message || 'Failed to add collaborator', 'error');
            }
        }
    };

    return (
        <>
            <Card>
                <div className="section-header">
                    <h3>Projects Portfolio</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* NEW: Show limit warning in badge */}
                        <span className="badge" style={{
                            background: isNearLimit ? 'var(--warning)' : 'var(--teal)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            {totalProjects}/{MAX_PROJECTS}
                            {isNearLimit && <span>⚠️</span>}
                        </span>
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                            disabled={totalProjects >= MAX_PROJECTS}
                        >
                            + Create Project
                        </Button>
                    </div>
                </div>

                {/* NEW: Limit warning banner */}
                {isNearLimit && (
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '16px'
                    }}>
                        <div style={{ color: 'var(--warning)', fontWeight: '600', fontSize: '0.9rem' }}>
                            ⚠️ You have {totalProjects}/{MAX_PROJECTS} projects. {totalProjects >= MAX_PROJECTS ? 'Limit reached!' : 'Approaching limit!'}
                        </div>
                    </div>
                )}

                {loading ? (
                    <LoadingSpinner />
                ) : !projects || projects.length === 0 ? (
                    <div className="empty-message">
                        <p>No projects yet. Start showcasing your work!</p>
                    </div>
                ) : (
                    <div className="projects-grid">
                        {projects.map((project, idx) => {
                            // NEW: Calculate collaborator status
                            const collabCount = project.collaborators?.length || 0;
                            const isNearCollabLimit = collabCount >= MAX_COLLABORATORS * 0.9;

                            return (
                                <div key={idx} className="project-card" style={{
                                    borderLeft: isNearCollabLimit ? '4px solid var(--warning)' : '4px solid var(--teal)'
                                }}>
                                    <h4>Project #{project.projectId.toString()}</h4>
                                    <div className="project-status" style={{
                                        color: project.status === 2 ? 'var(--success)' :
                                            project.status === 3 ? 'var(--error)' : 'var(--sky)'
                                    }}>
                                        Status: {projectStatuses[project.status]}
                                    </div>
                                    <p>Created: {formatDate(project.createdAt)}</p>
                                    {project.completedAt > 0 && (
                                        <p>Completed: {formatDate(project.completedAt)}</p>
                                    )}

                                    {/* NEW: Enhanced collaborator display with limit */}
                                    {collabCount > 0 && (
                                        <div style={{
                                            marginTop: '8px',
                                            padding: '8px',
                                            background: isNearCollabLimit ? 'rgba(245, 158, 11, 0.1)' : 'rgba(6, 182, 212, 0.1)',
                                            borderRadius: '6px',
                                            fontSize: '0.9rem'
                                        }}>
                                            <span style={{
                                                fontWeight: '600',
                                                color: isNearCollabLimit ? 'var(--warning)' : 'var(--teal-light)'
                                            }}>
                                                👥 Collaborators: {collabCount}/{MAX_COLLABORATORS}
                                                {isNearCollabLimit && ' ⚠️'}
                                            </span>
                                        </div>
                                    )}

                                    <div className="project-actions">
                                        <select
                                            className="status-select"
                                            value={project.status}
                                            onChange={(e) => handleUpdateStatus(project.projectId, parseInt(e.target.value))}
                                        >
                                            {projectStatuses.map((status, idx) => (
                                                <option key={idx} value={idx}>{status}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="collab-btn"
                                            onClick={() => {
                                                setSelectedProject(project);
                                                setShowCollabModal(true);
                                            }}
                                            disabled={collabCount >= MAX_COLLABORATORS}
                                            style={{
                                                opacity: collabCount >= MAX_COLLABORATORS ? 0.5 : 1,
                                                cursor: collabCount >= MAX_COLLABORATORS ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            + Collaborator
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            <Card>
                <div className="section-header">
                    <h3>Projects I'm Collaborating On</h3>
                    <span className="badge">{collaboratingOn?.length || 0}</span>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : !collaboratingOn || collaboratingOn.length === 0 ? (
                    <div className="empty-message">
                        <p>You're not collaborating on any projects yet</p>
                    </div>
                ) : (
                    <div className="projects-grid">
                        {collaboratingOn.map((project, idx) => (
                            <div key={idx} className="project-card" style={{ borderLeft: '4px solid var(--sky)' }}>
                                <h4>Project #{project.projectId.toString()}</h4>
                                <div className="project-owner">
                                    Owner: Token #{project.ownerTokenId}
                                </div>
                                <div className="project-status" style={{
                                    color: project.status === 2 ? 'var(--success)' :
                                        project.status === 3 ? 'var(--error)' : 'var(--sky)'
                                }}>
                                    Status: {projectStatuses[project.status]}
                                </div>
                                <p>Created: {formatDate(project.createdAt)}</p>
                                {project.completedAt > 0 && (
                                    <p>Completed: {formatDate(project.completedAt)}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Project">
                <div className="project-form">
                    {/* NEW: Limit warning in modal */}
                    {isNearLimit && (
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ color: 'var(--warning)', fontSize: '0.9rem' }}>
                                ⚠️ You have {totalProjects}/{MAX_PROJECTS} projects. {totalProjects >= MAX_PROJECTS ? 'Cannot create more!' : 'Approaching limit!'}
                            </div>
                        </div>
                    )}

                    <Input
                        label="Project Title"
                        value={projectData.title}
                        onChange={(val) => setProjectData({ ...projectData, title: val })}
                        placeholder="My Awesome Project"
                        required
                    />

                    <TextArea
                        label="Description"
                        value={projectData.description}
                        onChange={(val) => setProjectData({ ...projectData, description: val })}
                        placeholder="Describe your project..."
                        rows={4}
                    />

                    <Input
                        label="Project URL (Optional)"
                        value={projectData.url}
                        onChange={(val) => setProjectData({ ...projectData, url: val })}
                        placeholder="https://github.com/..."
                    />

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateProject} disabled={totalProjects >= MAX_PROJECTS}>
                            {totalProjects >= MAX_PROJECTS ? 'Limit Reached' : 'Create Project'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showCollabModal} onClose={() => setShowCollabModal(false)} title="Add Collaborator">
                <div className="collab-form">
                    {/* NEW: Collaborator limit warning */}
                    {selectedProject && (
                        <>
                            <div style={{
                                background: (selectedProject.collaborators?.length || 0) >= MAX_COLLABORATORS * 0.9 ?
                                    'rgba(245, 158, 11, 0.1)' : 'rgba(6, 182, 212, 0.1)',
                                border: `1px solid ${(selectedProject.collaborators?.length || 0) >= MAX_COLLABORATORS * 0.9 ?
                                    'rgba(245, 158, 11, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: (selectedProject.collaborators?.length || 0) >= MAX_COLLABORATORS * 0.9 ?
                                        'var(--warning)' : 'var(--teal-light)'
                                }}>
                                    👥 Project #{selectedProject.projectId.toString()} has {selectedProject.collaborators?.length || 0}/{MAX_COLLABORATORS} collaborators
                                    {(selectedProject.collaborators?.length || 0) >= MAX_COLLABORATORS && ' - Limit reached!'}
                                    {(selectedProject.collaborators?.length || 0) >= MAX_COLLABORATORS * 0.9 &&
                                        (selectedProject.collaborators?.length || 0) < MAX_COLLABORATORS && ' - Approaching limit!'}
                                </div>
                            </div>
                        </>
                    )}

                    <Input
                        label="Collaborator Token ID"
                        value={collabData}
                        onChange={setCollabData}
                        placeholder="Enter token ID"
                        type="number"
                        required
                    />

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowCollabModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddCollaborator}
                            disabled={(selectedProject?.collaborators?.length || 0) >= MAX_COLLABORATORS}
                        >
                            {(selectedProject?.collaborators?.length || 0) >= MAX_COLLABORATORS ?
                                'Limit Reached' : 'Add Collaborator'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <style>{`
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .section-header h3 {
                    font-size: 20px;
                    color: var(--beige);
                }

                .badge {
                    background: var(--teal);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .empty-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--gray-light);
                }

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }

                .project-card {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 20px;
                    border: 1px solid rgba(14, 116, 144, 0.3);
                }

                .project-card h4 {
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .project-status {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }

                .project-owner {
                    font-size: 13px;
                    color: var(--sky-light);
                    margin-bottom: 8px;
                    font-weight: 500;
                }

                .project-card p {
                    color: var(--gray-light);
                    font-size: 13px;
                    margin: 4px 0;
                }

                .project-actions {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(14, 116, 144, 0.2);
                    display: flex;
                    gap: 8px;
                }

                .status-select {
                    flex: 1;
                    background: rgba(14, 116, 144, 0.2);
                    border: 1px solid var(--teal);
                    color: var(--beige);
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                }

                .collab-btn {
                    background: var(--sky);
                    border: none;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.3s ease;
                }

                .collab-btn:hover:not(:disabled) {
                    background: var(--sky-light);
                    transform: translateY(-1px);
                }

                .collab-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </>
    );
}

