// User Management JavaScript
class UserManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalUsers = 0;
        this.currentFilters = {};
        this.editingUserId = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUsers();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentFilters.search = e.target.value;
                this.currentPage = 1;
                this.loadUsers();
            }, 300);
        });

        // Filter functionality
        document.getElementById('roleFilter').addEventListener('change', (e) => {
            this.currentFilters.role = e.target.value;
            this.currentPage = 1;
            this.loadUsers();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.currentFilters.isActive = e.target.value;
            this.currentPage = 1;
            this.loadUsers();
        });

        // Form submissions
        document.getElementById('userForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUserSubmit();
        });

        document.getElementById('inviteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleInviteSubmit();
        });

        // Modal close on outside click
        document.getElementById('userModal').addEventListener('click', (e) => {
            if (e.target.id === 'userModal') {
                this.closeUserModal();
            }
        });

        document.getElementById('inviteModal').addEventListener('click', (e) => {
            if (e.target.id === 'inviteModal') {
                this.closeInviteModal();
            }
        });
    }

    async loadUsers() {
        try {
            this.showLoading(true);
            
            const params = new URLSearchParams({
                page: this.currentPage.toString(),
                limit: this.pageSize.toString(),
                ...this.currentFilters
            });

            const response = await api.get(`/users?${params}`);
            
            // Handle direct API response format
            if (response.users) {
                this.renderUsers(response.users);
                this.updatePagination({
                    page: response.page || 1,
                    total: response.total || 0,
                    totalPages: response.totalPages || 1,
                    hasPreviousPage: (response.page || 1) > 1,
                    hasNextPage: (response.page || 1) < (response.totalPages || 1)
                });
            } else {
                throw new Error('Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Failed to load users. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <div class="empty-state">
                    <h3>No users found</h3>
                    <p>No users match your current filters.</p>
                </div>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <div class="table-row">
                <div class="user-info">
                    <div class="user-avatar">
                        ${this.getInitials(user.name || user.email)}
                    </div>
                    <div class="user-details">
                        <h4>${user.name || 'No Name'}</h4>
                        <p>ID: ${user.id.substring(0, 8)}...</p>
                    </div>
                </div>
                <div>${user.email}</div>
                <div>
                    <span class="role-badge role-${user.role}">${user.role}</span>
                </div>
                <div>
                    <span class="status-badge status-${user.isActive ? 'active' : 'inactive'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div>${this.formatDate(user.lastLoginAt)}</div>
                <div class="user-actions">
                    <button class="action-btn" onclick="userManager.editUser('${user.id}')" title="Edit User">
                        ✏️
                    </button>
                    <button class="action-btn" onclick="userManager.viewPermissions('${user.id}')" title="View Permissions">
                        🔐
                    </button>
                    ${user.role !== 'owner' ? `
                        <button class="action-btn danger" onclick="userManager.deleteUser('${user.id}')" title="Delete User">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    updatePagination(pagination) {
        if (!pagination) return;

        const paginationEl = document.getElementById('pagination');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const paginationInfo = document.getElementById('paginationInfo');

        paginationEl.style.display = 'flex';
        
        prevBtn.disabled = !pagination.hasPreviousPage;
        nextBtn.disabled = !pagination.hasNextPage;
        
        const start = (pagination.page - 1) * this.pageSize + 1;
        const end = Math.min(pagination.page * this.pageSize, pagination.total);
        
        paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total} users`;
        this.totalUsers = pagination.total;
    }

    changePage(direction) {
        this.currentPage += direction;
        this.loadUsers();
    }

    openCreateUserModal() {
        this.editingUserId = null;
        document.getElementById('modalTitle').textContent = 'Add New User';
        document.getElementById('submitBtn').textContent = 'Create User';
        document.getElementById('sendInvitationGroup').style.display = 'block';
        
        // Reset form
        document.getElementById('userForm').reset();
        document.getElementById('sendInvitation').checked = true;
        
        document.getElementById('userModal').classList.add('active');
    }

    async editUser(userId) {
        try {
            this.editingUserId = userId;
            document.getElementById('modalTitle').textContent = 'Edit User';
            document.getElementById('submitBtn').textContent = 'Update User';
            document.getElementById('sendInvitationGroup').style.display = 'none';

            const response = await api.get(`/users/${userId}`);
            
            if (response.success) {
                const user = response.data;
                document.getElementById('userName').value = user.name || '';
                document.getElementById('userEmail').value = user.email;
                document.getElementById('userRole').value = user.role;
                
                document.getElementById('userModal').classList.add('active');
            } else {
                throw new Error(response.error || 'Failed to load user');
            }
        } catch (error) {
            console.error('Error loading user:', error);
            this.showError('Failed to load user details.');
        }
    }

    async handleUserSubmit() {
        try {
            const formData = {
                name: document.getElementById('userName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRole').value
            };

            if (this.editingUserId) {
                // Update existing user
                const response = await api.put(`/users/${this.editingUserId}`, formData);
                
                if (response.success) {
                    this.showSuccess('User updated successfully');
                    this.closeUserModal();
                    this.loadUsers();
                } else {
                    throw new Error(response.error || 'Failed to update user');
                }
            } else {
                // Create new user
                formData.sendInvitation = document.getElementById('sendInvitation').checked;
                
                const response = await api.post('/users', formData);
                
                if (response.success) {
                    this.showSuccess('User created successfully');
                    this.closeUserModal();
                    this.loadUsers();
                } else {
                    throw new Error(response.error || 'Failed to create user');
                }
            }
        } catch (error) {
            console.error('Error saving user:', error);
            this.showError(error.message || 'Failed to save user');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await api.delete(`/users/${userId}`);
            
            if (response.success) {
                this.showSuccess('User deleted successfully');
                this.loadUsers();
            } else {
                throw new Error(response.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showError(error.message || 'Failed to delete user');
        }
    }

    async viewPermissions(userId) {
        try {
            const response = await api.get(`/users/${userId}/permissions`);
            
            if (response.success) {
                const permissions = response.data;
                this.showPermissionsModal(permissions);
            } else {
                throw new Error(response.error || 'Failed to load permissions');
            }
        } catch (error) {
            console.error('Error loading permissions:', error);
            this.showError('Failed to load user permissions.');
        }
    }

    showPermissionsModal(permissions) {
        const modalHtml = `
            <div class="modal active" id="permissionsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">User Permissions</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <div class="permissions-content">
                        <h3>Roles: ${permissions.roles.join(', ')}</h3>
                        <h4>Resource Permissions:</h4>
                        <div class="permissions-list">
                            ${Object.entries(permissions.resources).map(([resource, actions]) => `
                                <div class="permission-item">
                                    <strong>${resource}:</strong> ${actions.join(', ')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    openInviteModal() {
        document.getElementById('inviteForm').reset();
        document.getElementById('inviteModal').classList.add('active');
    }

    async handleInviteSubmit() {
        try {
            const formData = {
                email: document.getElementById('inviteEmail').value,
                role: document.getElementById('inviteRole').value,
                message: document.getElementById('inviteMessage').value
            };

            const response = await api.post('/users/invite', formData);
            
            if (response.success) {
                this.showSuccess('Invitation sent successfully');
                this.closeInviteModal();
            } else {
                throw new Error(response.error || 'Failed to send invitation');
            }
        } catch (error) {
            console.error('Error sending invitation:', error);
            this.showError(error.message || 'Failed to send invitation');
        }
    }

    closeUserModal() {
        document.getElementById('userModal').classList.remove('active');
        this.editingUserId = null;
    }

    closeInviteModal() {
        document.getElementById('inviteModal').classList.remove('active');
    }

    showLoading(show) {
        const loading = document.querySelector('.loading');
        if (loading) {
            loading.classList.toggle('active', show);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 600;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            background: ${type === 'success' ? '#22c55e' : '#ef4444'};
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    formatDate(dateString) {
        if (!dateString) return 'Never';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
    }
}

// Global functions for HTML onclick handlers
function openCreateUserModal() {
    userManager.openCreateUserModal();
}

function closeUserModal() {
    userManager.closeUserModal();
}

function openInviteModal() {
    userManager.openInviteModal();
}

function closeInviteModal() {
    userManager.closeInviteModal();
}

function changePage(direction) {
    userManager.changePage(direction);
}

// Initialize user manager when page loads
let userManager;
document.addEventListener('DOMContentLoaded', () => {
    userManager = new UserManager();
});

// Add styles for permissions modal
const permissionsStyles = `
    .permissions-content {
        margin: 1rem 0;
    }
    
    .permissions-list {
        margin-top: 1rem;
    }
    
    .permission-item {
        padding: 0.5rem;
        margin: 0.25rem 0;
        background: var(--bg-tertiary);
        border-radius: 0.25rem;
        font-size: 0.9rem;
    }
    
    .permission-item strong {
        color: var(--primary-color);
        text-transform: capitalize;
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = permissionsStyles;
document.head.appendChild(styleSheet);