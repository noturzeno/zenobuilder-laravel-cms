document.addEventListener('DOMContentLoaded', function(){
    const list = document.getElementById('blocks-list');
    const ordersInput = document.getElementById('orders-input');
    const reorderForm = document.getElementById('reorder-form');
    const saveOrderBtn = document.getElementById('save-order-btn');
    
    // ==========================================
    // WIDTH MAPPING HELPER
    // ==========================================
    // Always return full width - blocks should stack vertically
    // Layout blocks (two_column, three_column) handle side-by-side placement
    function getWidthClass(width) {
        // Always use full width in builder - blocks should stack vertically
        // Layout blocks (two_column, three_column) handle side-by-side placement
        return 'lg:col-span-12';
    }
    
    // Get content width class for visual display (blocks appear at their selected width but still stack)
    function getContentWidthClass(width) {
        const widthMap = {
            'full': 'w-full',
            'two-thirds': 'w-full max-w-2xl mx-auto',
            'half': 'w-full max-w-xl mx-auto',
            'third': 'w-full max-w-md mx-auto',
            'quarter': 'w-full max-w-sm mx-auto'
        };
        return widthMap[width] || 'w-full';
    }
    
    // Updates block element classes based on width value
    function updateBlockWidthClasses(element, width) {
        // Remove all possible width classes
        element.classList.remove('lg:col-span-12', 'lg:col-span-8', 'lg:col-span-6', 'lg:col-span-4', 'lg:col-span-3', 'lg:col-span-2', 'lg:col-span-1');
        // Add the correct class (always full width for stacking)
        element.classList.add(getWidthClass(width));
        
        // Get or create inner content width wrapper for visual display
        let contentWrapper = element.querySelector('.block-content-wrapper');
        if (!contentWrapper) {
            // If wrapper doesn't exist, create it by wrapping the content
            const contentArea = element.querySelector('.mt-3');
            if (contentArea && !contentArea.classList.contains('block-content-wrapper')) {
                // Create wrapper div
                contentWrapper = document.createElement('div');
                contentWrapper.className = 'mt-3 block-content-wrapper';
                // Move children into wrapper
                while (contentArea.firstChild) {
                    contentWrapper.appendChild(contentArea.firstChild);
                }
                // Replace contentArea with wrapper
                contentArea.parentNode.replaceChild(contentWrapper, contentArea);
            } else if (contentArea) {
                contentWrapper = contentArea;
                contentWrapper.classList.add('block-content-wrapper');
            }
        }
        
        if (contentWrapper) {
            // Remove old width classes
            contentWrapper.classList.remove('w-full', 'max-w-2xl', 'max-w-xl', 'max-w-md', 'max-w-sm', 'mx-auto');
            // Add new width class
            const contentWidthClass = getContentWidthClass(width);
            contentWrapper.classList.add(...contentWidthClass.split(' '));
        }
    }
    
    // ==========================================
    // UNDO/REDO HISTORY SYSTEM
    // ==========================================
    // Observer will be declared later, but we need a reference for restoreState
    let observer = null;
    
    const HistoryManager = {
        history: [],
        currentIndex: -1,
        maxHistorySize: 50,
        isExecuting: false,
        
        // Capture current state of all blocks
        captureState() {
            const blocks = [];
            if (list) {
                const blockItems = list.querySelectorAll('li[data-block-id], li[data-temp-id]');
                blockItems.forEach((li, index) => {
                    const blockId = li.getAttribute('data-block-id');
                    const tempId = li.getAttribute('data-temp-id');
                    const preview = li.querySelector('.block-preview');
                    
                    if (preview) {
                        const blockType = preview.getAttribute('data-type');
                        const width = li.getAttribute('data-width') || 'full';
                        const content = preview.getAttribute('data-content') || '{}';
                        
                        // Try to get updated content from edit forms
                        const editForm = li.querySelector('.block-edit-form');
                        let finalContent = content;
                        
                        if (editForm) {
                            const contentInput = editForm.querySelector('input[name="content"], textarea.block-content-input, .divider-content-input, .spacer-content-input, .button-content-input, .video-content-input, .richtext-content-input, .image-content-input, .heading-content-input, .gallery-content-input, .code-content-input, .map-content-input, .testimonial-content-input, .hero-content-input, .column-content-input');
                            if (contentInput && contentInput.value) {
                                finalContent = contentInput.value;
                            }
                        }
                        
                        blocks.push({
                            id: blockId ? parseInt(blockId) : null,
                            tempId: tempId || null,
                            type: blockType,
                            width: width,
                            content: finalContent,
                            order: index
                        });
                    }
                });
            }
            return JSON.stringify(blocks);
        },
        
        // Restore state from snapshot
        restoreState(snapshot) {
            if (!list || !snapshot) return;
            
            // Temporarily disable observer to avoid capturing restore as a change
            if (observer) {
                observer.disconnect();
            }
            
            this.isExecuting = true;
            
            try {
                const blocks = JSON.parse(snapshot);
                
                // Clear current list (but keep empty message structure)
                const emptyMsg = list.querySelector('li.text-gray-500');
                list.innerHTML = '';
                if (emptyMsg) {
                    list.appendChild(emptyMsg);
                }
                
                // Recreate blocks in order
                blocks.forEach(blockData => {
                    const blockType = blockData.type;
                    const width = blockData.width || 'full';
                    const content = blockData.content || '{}';
                    
                    // Create block element - ensure createTempBlockElement is accessible
                    let newBlock;
                    if (typeof createTempBlockElement === 'function') {
                        newBlock = createTempBlockElement(blockType, content, width);
                    } else {
                        console.error('createTempBlockElement is not accessible');
                        return;
                    }
                    
                    // Restore block ID if it was a saved block
                    if (blockData.id) {
                        newBlock.setAttribute('data-block-id', blockData.id);
                        newBlock.removeAttribute('data-temp-id');
                        // If this block was deleted, remove it from deletedBlockIds since we're restoring it
                        if (typeof window.deletedBlockIds !== 'undefined') {
                            window.deletedBlockIds.delete(blockData.id);
                        }
                    } else if (blockData.tempId) {
                        newBlock.setAttribute('data-temp-id', blockData.tempId);
                    }
                    
                    // Restore width
                    newBlock.setAttribute('data-width', width);
                    const widthInput = newBlock.querySelector('.hidden-width-input');
                    if (widthInput) {
                        widthInput.value = width;
                    }
                    
                    // Update header width selector if it exists (for saved blocks)
                    if (blockData.id) {
                        const headerWidthSelect = newBlock.querySelector('.header-width');
                        if (headerWidthSelect) {
                            headerWidthSelect.value = width;
                        }
                    }
                    
                    // Update temp width selector if it exists (for temp blocks)
                    const tempWidthSelect = newBlock.querySelector('.temp-width');
                    if (tempWidthSelect) {
                        tempWidthSelect.value = width;
                    }
                    
                    // Update column span classes based on width
                    updateBlockWidthClasses(newBlock, width);
                    
                    // Restore content in preview and form
                    const preview = newBlock.querySelector('.block-preview');
                    if (preview) {
                        preview.setAttribute('data-content', content);
                        preview.setAttribute('data-type', blockType);
                    }
                    
                    // Restore content in hidden inputs
                    const editForm = newBlock.querySelector('.block-edit-form');
                    if (editForm) {
                        const contentInput = editForm.querySelector('input[name="content"], textarea.block-content-input, .divider-content-input, .spacer-content-input, .button-content-input, .video-content-input, .richtext-content-input, .image-content-input, .heading-content-input, .gallery-content-input, .code-content-input, .map-content-input, .testimonial-content-input, .hero-content-input, .column-content-input');
                        if (contentInput) {
                            contentInput.value = content;
                        }
                    }
                    
                    list.appendChild(newBlock);
                });
                
                // Reattach drag and drop
                if (typeof attachDnD === 'function') {
                    attachDnD();
                }
                if (typeof updateOrders === 'function') {
                    updateOrders(false);
                }
                if (typeof refreshAllPreviews === 'function') {
                    refreshAllPreviews();
                }
                if (typeof updateEmptyMessage === 'function') {
                    updateEmptyMessage();
                }
                
                // Re-setup editors for all blocks
                list.querySelectorAll('li[data-block-id], li[data-temp-id]').forEach(li => {
                    const preview = li.querySelector('.block-preview');
                    if (!preview) return;
                    const blockType = preview.getAttribute('data-type');
                    
                    // Re-setup editor based on block type
                    if (blockType === 'heading' && typeof setupHeadingEditor === 'function') setupHeadingEditor(li);
                    else if (blockType === 'image' && typeof setupImageEditor === 'function') setupImageEditor(li);
                    else if (blockType === 'gallery' && typeof setupGalleryEditor === 'function') setupGalleryEditor(li);
                    else if (blockType === 'map' && typeof setupMapEditor === 'function') setupMapEditor(li);
                    else if (blockType === 'testimonial' && typeof setupTestimonialEditor === 'function') setupTestimonialEditor(li);
                    else if (blockType === 'code' && typeof setupCodeEditor === 'function') setupCodeEditor(li);
                    else if (blockType === 'hero_section' && typeof setupHeroSectionEditor === 'function') setupHeroSectionEditor(li);
                    else if (blockType === 'richtext' && typeof setupRichTextEditor === 'function') setupRichTextEditor(li);
                    else if (blockType === 'spacer' && typeof setupSpacerEditor === 'function') setupSpacerEditor(li);
                    else if (blockType === 'button' && typeof setupButtonEditor === 'function') setupButtonEditor(li);
                    else if (blockType === 'video' && typeof setupVideoEditor === 'function') setupVideoEditor(li);
                    else if (blockType === 'divider' && typeof setupDividerEditor === 'function') setupDividerEditor(li);
                    else if ((blockType === 'two_column' || blockType === 'three_column') && typeof setupColumnEditor === 'function') setupColumnEditor(li);
                });
                
                // Rebind header width controls for restored blocks
                if (typeof bindHeaderWidthControls === 'function') {
                    bindHeaderWidthControls();
                }
                
                // Reconnect observer
                if (observer && list) {
                    observer.observe(list, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['data-content', 'data-width']
                    });
                }
                
            } catch (e) {
                console.error('Error restoring state:', e);
            } finally {
                this.isExecuting = false;
            }
        },
        
        // Save current state to history
        saveState() {
            if (this.isExecuting) return; // Don't save during undo/redo execution
            
            // Remove any future history (if we're undoing and then making a new change)
            if (this.currentIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.currentIndex + 1);
            }
            
            // Capture current state
            const snapshot = this.captureState();
            
            // Add to history
            this.history.push(snapshot);
            this.currentIndex = this.history.length - 1;
            
            // Limit history size
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
                this.currentIndex--;
            }
        },
        
        // Undo last action
        undo() {
            if (this.currentIndex <= 0) {
                // Already at initial state
                return false;
            }
            
            this.currentIndex--;
            const snapshot = this.history[this.currentIndex];
            this.restoreState(snapshot);
            return true;
        },
        
        // Redo last undone action
        redo() {
            if (this.currentIndex >= this.history.length - 1) {
                // Already at latest state
                return false;
            }
            
            this.currentIndex++;
            const snapshot = this.history[this.currentIndex];
            this.restoreState(snapshot);
            return true;
        },
        
        // Initialize with current state
        init() {
            this.saveState();
        }
    };
    
    // Keyboard shortcuts for undo/redo
    document.addEventListener('keydown', function(e) {
        // Don't trigger if user is typing in an input field or textarea
        const isInputFocused = 
            document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA' ||
            (document.activeElement?.contentEditable === 'true' && !document.activeElement?.classList.contains('richtext-editor'));
        
        // Allow undo/redo in contenteditable richtext editor
        const isRichTextEditor = document.activeElement?.classList.contains('richtext-editor');
        
        // Ctrl+Z / Cmd+Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            if (!isInputFocused || isRichTextEditor) {
                e.preventDefault();
                const success = HistoryManager.undo();
                if (success) {
                    // Show visual feedback
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'info',
                            title: 'Undone',
                            text: 'Last action has been undone',
                            timer: 1000,
                            showConfirmButton: false,
                            toast: true,
                            position: 'top-end'
                        });
                    }
                }
            }
        }
        
        // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y for redo
        if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
            if (!isInputFocused || isRichTextEditor) {
                e.preventDefault();
                const success = HistoryManager.redo();
                if (success) {
                    // Show visual feedback
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'info',
                            title: 'Redone',
                            text: 'Action has been redone',
                            timer: 1000,
                            showConfirmButton: false,
                            toast: true,
                            position: 'top-end'
                        });
                    }
                }
            }
        }
    });
    
    // Initialize history with current state
    HistoryManager.init();
    
    // Function to update empty message visibility
    function updateEmptyMessage() {
        const emptyMessage = list?.querySelector('li.text-gray-500');
        if(emptyMessage) {
            // Count actual block items (excluding the empty message itself)
            const blockItems = list?.querySelectorAll('li[data-block-id], li[data-temp-id]');
            const hasBlocks = blockItems && blockItems.length > 0;
            emptyMessage.style.display = hasBlocks ? 'none' : 'block';
        }
    }

    // ==========================================
    // BLOCK LOCKING SYSTEM (defined early for use in attachDnD)
    // ==========================================
    const BlockLockManager = {
        storageKey: 'blockLocks_' + (window.location.pathname.match(/\/pages\/(\d+)/) ? window.location.pathname.match(/\/pages\/(\d+)/)[1] : 'default'),
        lockedBlocks: new Set(),
        
        init() {
            this.loadLockedBlocks();
            this.attachLockListeners();
            this.updateAllLockStates();
        },
        
        loadLockedBlocks() {
            try {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    const lockedIds = JSON.parse(stored);
                    // Handle both numeric IDs and temp string IDs
                    // Filter out temp IDs that no longer exist in the DOM (e.g., after page reload)
                    const validLockedIds = lockedIds.filter(id => {
                        if (typeof id === 'string' && id.startsWith('temp-')) {
                            // Only keep temp IDs if they exist in the DOM
                            return list?.querySelector(`li[data-temp-id="${id}"]`) !== null;
                        }
                        // Keep all numeric IDs (they might not be in DOM yet but should be after blocks load)
                        return true;
                    });
                    
                    this.lockedBlocks = new Set(validLockedIds.map(id => {
                        // If it's a string starting with "temp-", keep it as string
                        // Otherwise, convert to integer
                        return (typeof id === 'string' && id.startsWith('temp-')) ? id : parseInt(id);
                    }));
                    
                    // Save cleaned up list back to localStorage
                    if (validLockedIds.length !== lockedIds.length) {
                        this.saveLockedBlocks();
                    }
                }
            } catch (e) {
                console.warn('Failed to load locked blocks:', e);
                this.lockedBlocks = new Set();
            }
        },
        
        saveLockedBlocks() {
            try {
                const lockedIds = Array.from(this.lockedBlocks);
                localStorage.setItem(this.storageKey, JSON.stringify(lockedIds));
            } catch (e) {
                console.warn('Failed to save locked blocks:', e);
            }
        },
        
        isLocked(blockId) {
            if (!blockId) return false;
            // Handle both numeric IDs (saved blocks) and string IDs (temp blocks)
            const id = (typeof blockId === 'string' && blockId.startsWith('temp-')) ? blockId : parseInt(blockId);
            return this.lockedBlocks.has(id);
        },
        
        lockBlock(blockId) {
            if (!blockId) return;
            // Handle both numeric IDs (saved blocks) and string IDs (temp blocks)
            const id = (typeof blockId === 'string' && blockId.startsWith('temp-')) ? blockId : parseInt(blockId);
            this.lockedBlocks.add(id);
            this.saveLockedBlocks();
            this.updateBlockLockState(blockId, true);
        },
        
        unlockBlock(blockId) {
            if (!blockId) return;
            // Handle both numeric IDs (saved blocks) and string IDs (temp blocks)
            const id = (typeof blockId === 'string' && blockId.startsWith('temp-')) ? blockId : parseInt(blockId);
            this.lockedBlocks.delete(id);
            this.saveLockedBlocks();
            this.updateBlockLockState(blockId, false);
        },
        
        unlockAllBlocks() {
            this.lockedBlocks.clear();
            this.saveLockedBlocks();
            this.updateAllLockStates();
        },
        
        updateBlockLockState(blockId, isLocked) {
            if (!blockId) return;
            // Try to find block by data-block-id first (saved blocks)
            let li = list?.querySelector(`li[data-block-id="${blockId}"]`);
            // If not found, try to find by data-temp-id (temp blocks)
            if (!li && typeof blockId === 'string' && blockId.startsWith('temp-')) {
                li = list?.querySelector(`li[data-temp-id="${blockId}"]`);
            }
            if (!li) return;
            
            const checkbox = li.querySelector('.block-select-checkbox');
            
            if (isLocked) {
                li.classList.add('block-locked');
                // Disable dragging for locked blocks
                li.draggable = false;
                // Disable checkbox and uncheck if selected
                if (checkbox) {
                    checkbox.disabled = true;
                    checkbox.checked = false;
                }
                // Remove selection state
                li.classList.remove('block-selected');
            } else {
                li.classList.remove('block-locked');
                // Re-enable dragging
                li.draggable = true;
                // Enable checkbox
                if (checkbox) {
                    checkbox.disabled = false;
                }
            }
            
            // Update bulk action buttons
            if (typeof updateBulkActionButtons === 'function') {
                updateBulkActionButtons();
            }
        },
        
        updateAllLockStates() {
            if (!list) return;
            // Check both saved blocks and temp blocks
            const allBlocks = list.querySelectorAll('li[data-block-id], li[data-temp-id]');
            allBlocks.forEach(li => {
                const blockId = li.getAttribute('data-block-id') || li.getAttribute('data-temp-id');
                const checkbox = li.querySelector('.block-select-checkbox');
                
                if (blockId && this.isLocked(blockId)) {
                    li.classList.add('block-locked');
                    // Disable dragging for locked blocks
                    li.draggable = false;
                    // Disable checkbox and uncheck if selected
                    if (checkbox) {
                        checkbox.disabled = true;
                        checkbox.checked = false;
                    }
                    // Remove selection state
                    li.classList.remove('block-selected');
                } else {
                    li.classList.remove('block-locked');
                    // Re-enable dragging (if not locked)
                    if (!blockId || !this.isLocked(blockId)) {
                        li.draggable = true;
                    }
                    // Enable checkbox
                    if (checkbox) {
                        checkbox.disabled = false;
                    }
                }
            });
            // Re-apply drag handlers if attachDnD exists
            if (typeof attachDnD === 'function') {
                attachDnD();
            }
            // Update bulk action buttons
            if (typeof updateBulkActionButtons === 'function') {
                updateBulkActionButtons();
            }
        },
        
        attachLockListeners() {
            // Lock/unlock button clicks
            document.addEventListener('click', (e) => {
                const lockBtn = e.target.closest('.block-lock-btn');
                if (lockBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Try to find block with data-block-id first (saved blocks)
                    let li = lockBtn.closest('li[data-block-id]');
                    let blockId = li ? li.getAttribute('data-block-id') : null;
                    
                    // If no saved block ID, try temp block (for newly added blocks)
                    if (!blockId) {
                        li = lockBtn.closest('li[data-temp-id]');
                        const tempId = li ? li.getAttribute('data-temp-id') : null;
                        if (tempId) {
                            // For temp blocks, use temp ID for locking
                            // This will be converted to real ID when block is saved
                            if (this.isLocked(tempId)) {
                                this.unlockBlock(tempId);
                            } else {
                                this.lockBlock(tempId);
                            }
                            // Update bulk action buttons if block is selected
                            if (typeof updateBulkActionButtons === 'function') {
                                updateBulkActionButtons();
                            }
                            return;
                        }
                    }
                    
                    if (!blockId) return;
                    
                    if (this.isLocked(blockId)) {
                        this.unlockBlock(blockId);
                    } else {
                        this.lockBlock(blockId);
                    }
                    
                    // Update bulk action buttons if block is selected
                    if (typeof updateBulkActionButtons === 'function') {
                        updateBulkActionButtons();
                    }
                }
            });
            
            // Unlock All button
            const unlockAllBtn = document.getElementById('unlock-all-blocks-btn');
            if (unlockAllBtn) {
                unlockAllBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.unlockAllBlocks();
                    // Update bulk action buttons after unlocking all
                    if (typeof updateBulkActionButtons === 'function') {
                        updateBulkActionButtons();
                    }
                });
            }
        }
    };
    
    // Initialize block locking after DOM is ready (list needs to be defined)
    // Note: init() will be called later when list is available
    
    // Enable drag-and-drop
    let dragged;
    let dragStartState = null;
    // Track event listeners to avoid duplicates
    const dragListeners = new WeakMap();
    
    function attachDnD(){
        list.querySelectorAll('li').forEach(li => {
            // Skip if already has listeners
            if (dragListeners.has(li)) return;
            
            const blockId = li.getAttribute('data-block-id');
            // Safety check: BlockLockManager might not be initialized yet
            const isLocked = blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId);
            
            // Locked blocks cannot be dragged
            li.draggable = !isLocked;
            
            if (!isLocked) {
                const dragStartHandler = (e) => { 
                    // Don't allow dragging locked blocks (double check)
                    const blockId = li.getAttribute('data-block-id');
                    if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
                        e.preventDefault();
                        return false;
                    }
                    dragged = li; 
                    li.classList.add('opacity-50');
                    // Save state before drag
                    dragStartState = HistoryManager.captureState();
                };
                
                const dragEndHandler = () => { 
                    if(dragged){ 
                        dragged.classList.remove('opacity-50'); 
                        // Save state after drag completes
                        HistoryManager.saveState();
                        dragged = null; 
                        updateOrders(true); 
                    } 
                };
                
                const dragOverHandler = (e) => { e.preventDefault(); };
                
                const dropHandler = (e) => { 
                    e.preventDefault(); 
                    if(dragged && dragged !== li){ 
                        // Don't allow dropping if target or dragged block is locked
                        const targetBlockId = li.getAttribute('data-block-id');
                        const draggedBlockId = dragged.getAttribute('data-block-id');
                        if ((typeof BlockLockManager !== 'undefined') && BlockLockManager && 
                            ((targetBlockId && BlockLockManager.isLocked(targetBlockId)) ||
                             (draggedBlockId && BlockLockManager.isLocked(draggedBlockId)))) {
                            return;
                        }
                        li.parentNode.insertBefore(dragged, li.nextSibling);
                        // State will be saved on dragend
                    }
                };
                
                li.addEventListener('dragstart', dragStartHandler);
                li.addEventListener('dragend', dragEndHandler);
                li.addEventListener('dragover', dragOverHandler);
                li.addEventListener('drop', dropHandler);
                
                // Store handlers for potential cleanup
                dragListeners.set(li, {
                    dragstart: dragStartHandler,
                    dragend: dragEndHandler,
                    dragover: dragOverHandler,
                    drop: dropHandler
                });
            }
        });
    }

    function updateOrders(showButton){
        const orders = {};
        let order = 1;
        list.querySelectorAll('li').forEach(li => {
            const id = li.getAttribute('data-block-id');
            if(id){ orders[id] = order++; }
        });
        ordersInput.value = JSON.stringify(orders);
        if(showButton && saveOrderBtn){ saveOrderBtn.classList.remove('hidden'); }
    }

    if(list){ attachDnD(); updateOrders(false); updateEmptyMessage(); }
    
    // Initialize block locking now that list is available
    if (typeof BlockLockManager !== 'undefined') {
        BlockLockManager.init();
    }

    // Save order button posts the form
    if(saveOrderBtn){
        saveOrderBtn.addEventListener('click', function(){ reorderForm.submit(); });
    }

    // Modal add-block flow
    const modal = document.getElementById('add-block-modal');
    const closeModalBtn = document.getElementById('close-add-block');
    const openBtns = document.querySelectorAll('.open-add-block');
    const form = document.getElementById('modal-add-block-form');
    const typeInput = document.getElementById('modal-block-type');
    const contentInput = document.getElementById('modal-block-content');
    const widthInput = document.getElementById('modal-block-width');
    let pendingAreaWidth = 'full';
    let targetBlockElement = null; // Store the target block element when "Add Block Below" is clicked

    function openModal(defaultWidth, targetBlock = null){
        pendingAreaWidth = defaultWidth || 'full';
        targetBlockElement = targetBlock; // Store the target block
        if(widthInput){ widthInput.value = pendingAreaWidth; }
        if(modal){ 
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            modal.style.display = 'flex';
            
            // Check if modal has column context (adding block inside layout)
            const hasColumnContext = modal.hasAttribute('data-column-context');
            const twoColumnBtn = modal.querySelector('button[data-type="two_column"]');
            const threeColumnBtn = modal.querySelector('button[data-type="three_column"]');
            
            // Hide layout blocks if adding inside a layout to prevent nested layouts
            if(hasColumnContext) {
                if(twoColumnBtn) twoColumnBtn.style.display = 'none';
                if(threeColumnBtn) threeColumnBtn.style.display = 'none';
            } else {
                // Show layout blocks when not inside a layout
                if(twoColumnBtn) twoColumnBtn.style.display = '';
                if(threeColumnBtn) threeColumnBtn.style.display = '';
            }
        }
    }
    function closeModal(){ 
        if(modal){ 
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            modal.style.display = 'none';
            // Clear column context and restore layout buttons
            modal.removeAttribute('data-column-context');
            const twoColumnBtn = modal.querySelector('button[data-type="two_column"]');
            const threeColumnBtn = modal.querySelector('button[data-type="three_column"]');
            if(twoColumnBtn) twoColumnBtn.style.display = '';
            if(threeColumnBtn) threeColumnBtn.style.display = '';
        }
    }

    // Nested block edit modal functions
    let currentNestedBlockContext = null;
    
    function openNestedBlockEditModal(blockType, blockContent, columnIndex, blockIndex, parentLi){
        
        const editModal = document.getElementById('edit-nested-block-modal');
        const editContent = document.getElementById('edit-nested-block-content');
        
        if(!editModal){
            return;
        }
        if(!editContent){
            return;
        }
        
        // Store context for saving
        currentNestedBlockContext = {
            columnIndex: columnIndex,
            blockIndex: blockIndex,
            parentLi: parentLi,
            blockType: blockType
        };
        
        // Generate editor HTML based on block type
        let editorHtml = generateNestedBlockEditor(blockType, blockContent);
        editContent.innerHTML = editorHtml;
        
        // Wire up heading editor interactions if it's a heading block
        if(blockType === 'heading'){
            const backgroundTypeSelect = document.getElementById('edit-heading-background-type');
            const bgColorContainer = document.getElementById('edit-heading-background-color-container');
            const bgImageContainer = document.getElementById('edit-heading-background-image-container');
            const fontColorInput = document.getElementById('edit-heading-font-color');
            const fontColorText = document.getElementById('edit-heading-font-color-text');
            const backgroundColorInput = document.getElementById('edit-heading-background-color');
            const backgroundColorText = document.getElementById('edit-heading-background-color-text');
            
            // Wire background type select
            if(backgroundTypeSelect){
                backgroundTypeSelect.addEventListener('change', () => {
                    const bgType = backgroundTypeSelect.value;
                    if(bgColorContainer){
                        bgColorContainer.style.display = bgType === 'color' ? 'block' : 'none';
                    }
                    if(bgImageContainer){
                        bgImageContainer.style.display = bgType === 'image' ? 'block' : 'none';
                    }
                });
            }
            
            // Wire font color inputs
            if(fontColorInput && fontColorText){
                fontColorInput.addEventListener('input', () => {
                    fontColorText.value = fontColorInput.value;
                });
                fontColorText.addEventListener('input', () => {
                    if(/^#[0-9A-F]{6}$/i.test(fontColorText.value)){
                        fontColorInput.value = fontColorText.value;
                    }
                });
            }
            
            // Wire background color inputs
            if(backgroundColorInput && backgroundColorText){
                backgroundColorInput.addEventListener('input', () => {
                    backgroundColorText.value = backgroundColorInput.value;
                });
                backgroundColorText.addEventListener('input', () => {
                    if(/^#[0-9A-F]{6}$/i.test(backgroundColorText.value)){
                        backgroundColorInput.value = backgroundColorText.value;
                    }
                });
            }
        }
        
        // Wire up richtext editor interactions if it's a richtext block
        if(blockType === 'richtext'){
            const richtextBackgroundTypeSelect = document.getElementById('edit-richtext-background-type');
            const richtextBgColorContainer = document.getElementById('edit-richtext-background-color-container');
            const richtextBgImageContainer = document.getElementById('edit-richtext-background-image-container');
            const richtextBackgroundColorInput = document.getElementById('edit-richtext-background-color');
            const richtextBackgroundColorText = document.getElementById('edit-richtext-background-color-text');
            
            // Wire background type select
            if(richtextBackgroundTypeSelect){
                richtextBackgroundTypeSelect.addEventListener('change', () => {
                    const bgType = richtextBackgroundTypeSelect.value;
                    if(richtextBgColorContainer){
                        richtextBgColorContainer.style.display = bgType === 'color' ? 'block' : 'none';
                    }
                    if(richtextBgImageContainer){
                        richtextBgImageContainer.style.display = bgType === 'image' ? 'block' : 'none';
                    }
                });
            }
            
            // Wire background color inputs
            if(richtextBackgroundColorInput && richtextBackgroundColorText){
                richtextBackgroundColorInput.addEventListener('input', () => {
                    richtextBackgroundColorText.value = richtextBackgroundColorInput.value;
                });
                richtextBackgroundColorText.addEventListener('input', () => {
                    if(/^#[0-9A-F]{6}$/i.test(richtextBackgroundColorText.value)){
                        richtextBackgroundColorInput.value = richtextBackgroundColorText.value;
                    }
                });
            }
        }
        
        // Wire up gallery editor interactions if it's a gallery block
        if(blockType === 'gallery'){
            const displaySelect = document.getElementById('edit-gallery-display');
            const autoplayCheckbox = document.getElementById('edit-gallery-autoplay');
            const autoplayContainer = document.getElementById('edit-gallery-autoplay-container');
            const imagesList = document.getElementById('edit-gallery-images-list');
            const addImageBtn = document.getElementById('edit-gallery-add-image');
            
            // Display type change
            if(displaySelect && autoplayContainer){
                displaySelect.addEventListener('change', () => {
                    const isSlider = displaySelect.value === 'slider';
                    autoplayContainer.style.display = isSlider ? 'block' : 'none';
                });
            }
            
            // Add image button
            if(addImageBtn && imagesList){
                addImageBtn.addEventListener('click', () => {
                    const item = document.createElement('div');
                    item.className = 'flex items-center gap-2 p-2 bg-gray-50 border rounded gallery-image-item';
                    item.setAttribute('data-image-index', Date.now());
                    
                    item.innerHTML = `
                        <div class="flex-1 grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-xs text-gray-600 mb-1">Image URL</label>
                                <input type="text" value="" class="w-full border rounded px-2 py-1 text-xs gallery-image-src" placeholder="/path/to/image.jpg">
                            </div>
                            <div>
                                <label class="block text-xs text-gray-600 mb-1">Alt Text</label>
                                <input type="text" value="" class="w-full border rounded px-2 py-1 text-xs gallery-image-alt" placeholder="Alt text">
                            </div>
                        </div>
                        <button type="button" class="text-red-600 hover:text-red-800 gallery-remove-image-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    
                    // Remove button
                    const removeBtn = item.querySelector('.gallery-remove-image-btn');
                    if(removeBtn){
                        removeBtn.addEventListener('click', () => {
                            item.remove();
                        });
                    }
                    
                    imagesList.appendChild(item);
                });
            }
            
            // Wire up existing remove buttons
            if(imagesList){
                imagesList.querySelectorAll('.gallery-remove-image-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const item = btn.closest('.gallery-image-item');
                        if(item) item.remove();
                    });
                });
            }
        }
        
        // Wire up richtext editor interactions if it's a richtext block
        if(blockType === 'richtext'){
            setupNestedRichTextEditor();
        }
        
        // Wire up image editor interactions if it's an image block
        if(blockType === 'image'){
            setupNestedImageEditor();
        }
        
        // Show modal
        editModal.classList.remove('hidden');
        editModal.classList.add('flex');
        editModal.style.display = 'flex';
        
    }
    
    function setupNestedRichTextEditor(){
        const editContent = document.getElementById('edit-nested-block-content');
        if(!editContent) return;
        
        const editor = editContent.querySelector('.richtext-editor');
        const toolbarBtns = editContent.querySelectorAll('.richtext-toolbar-btn');
        const styleSelect = editContent.querySelector('#edit-richtext-style');
        const backgroundTypeSelect = editContent.querySelector('#edit-richtext-background-type');
        const backgroundColorInput = editContent.querySelector('#edit-richtext-background-color');
        const backgroundColorText = editContent.querySelector('#edit-richtext-background-color-text');
        const backgroundImageInput = editContent.querySelector('#edit-richtext-background-image');
        const heightInput = editContent.querySelector('#edit-richtext-height');
        const paddingInput = editContent.querySelector('#edit-richtext-padding');
        
        if(!editor) return;
        
        // Handle placeholder
        editor.addEventListener('focus', function() {
            if(this.textContent.trim() === (this.dataset.placeholder || 'Write something...')){
                this.textContent = '';
            }
        });
        
        editor.addEventListener('blur', function() {
            if(this.textContent.trim() === ''){
                this.textContent = this.dataset.placeholder || 'Write something...';
            }
        });
        
        // Wire toolbar buttons
        toolbarBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const command = this.dataset.command;
                const arg = this.dataset.arg;
                
                editor.focus();
                
                if(command === 'formatBlock' && arg){
                    // Ensure we have a selection for formatBlock
                    const selection = window.getSelection();
                    if(selection.rangeCount === 0){
                        const range = document.createRange();
                        range.selectNodeContents(editor);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                    document.execCommand('formatBlock', false, arg);
                } else if(this.classList.contains('richtext-link-btn')){
                    const selection = window.getSelection();
                    const selectedText = selection.toString();
                    const url = prompt(selectedText ? `Enter URL for "${selectedText}":` : 'Enter URL:');
                    if(url){
                        if(selectedText){
                            document.execCommand('createLink', false, url);
                        } else {
                            const linkText = prompt('Enter link text:', 'Link');
                            if(linkText){
                                document.execCommand('insertHTML', false, `<a href="${url}">${linkText}</a>`);
                            }
                        }
                    }
                } else if(this.classList.contains('richtext-table-btn')){
                    const rows = prompt('Enter number of rows:', '3');
                    const cols = prompt('Enter number of columns:', '3');
                    if(rows && cols && !isNaN(rows) && !isNaN(cols)){
                        const r = parseInt(rows);
                        const c = parseInt(cols);
                        let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;"><tbody>';
                        for(let i = 0; i < r; i++){
                            tableHTML += '<tr>';
                            for(let j = 0; j < c; j++){
                                tableHTML += `<td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>`;
                            }
                            tableHTML += '</tr>';
                        }
                        tableHTML += '</tbody></table>';
                        document.execCommand('insertHTML', false, tableHTML);
                    }
                } else {
                    // For list commands, ensure proper selection
                    if(command === 'insertUnorderedList' || command === 'insertOrderedList'){
                        // Ensure editor has focus first
                        editor.focus();
                        
                        // Use setTimeout to ensure focus is established
                        setTimeout(() => {
                            const selection = window.getSelection();
                            let range;
                            let blockElement = null;
                            
                            // Get current selection range if it exists
                            if(selection.rangeCount > 0){
                                range = selection.getRangeAt(0);
                                // Find the current block element from the range
                                let node = range.commonAncestorContainer;
                                if(node.nodeType === Node.TEXT_NODE){
                                    node = node.parentNode;
                                }
                                // Walk up to find a block element
                                while(node && node !== editor && node.nodeType !== Node.DOCUMENT_NODE){
                                    if(node.nodeType === Node.ELEMENT_NODE){
                                        const tagName = node.tagName;
                                        if(tagName === 'P' || tagName === 'DIV' || tagName === 'LI' || 
                                           tagName === 'H1' || tagName === 'H2' || tagName === 'H3' || 
                                           tagName === 'H4' || tagName === 'H5' || tagName === 'H6'){
                                            blockElement = node;
                                            break;
                                        }
                                    }
                                    node = node.parentNode;
                                }
                            }
                            
                            // If no block element found, create one
                            if(!blockElement || blockElement === editor){
                                blockElement = document.createElement('p');
                                
                                if(selection.rangeCount > 0){
                                    try {
                                        const currentRange = selection.getRangeAt(0);
                                        // Insert at cursor position
                                        if(currentRange.startContainer.nodeType === Node.TEXT_NODE){
                                            const textNode = currentRange.startContainer;
                                            const parent = textNode.parentNode;
                                            const offset = currentRange.startOffset;
                                            
                                            if(offset === 0){
                                                parent.insertBefore(blockElement, textNode);
                                            } else if(offset === textNode.length){
                                                parent.insertBefore(blockElement, textNode.nextSibling);
                                            } else {
                                                // Split text node and insert in between
                                                const newNode = textNode.splitText(offset);
                                                parent.insertBefore(blockElement, newNode);
                                            }
                                        } else {
                                            currentRange.insertNode(blockElement);
                                        }
                                        range = document.createRange();
                                        range.selectNodeContents(blockElement);
                                        range.collapse(false);
                                    } catch(e) {
                                        editor.appendChild(blockElement);
                                        range = document.createRange();
                                        range.selectNodeContents(blockElement);
                                        range.collapse(false);
                                    }
                                } else {
                                    // If editor is empty or has no content, add paragraph
                                    if(editor.innerHTML.trim() === '' || editor.textContent.trim() === ''){
                                        editor.innerHTML = '<p></p>';
                                        blockElement = editor.querySelector('p');
                                    } else {
                                        editor.appendChild(blockElement);
                                    }
                                    if(!blockElement) blockElement = editor.querySelector('p') || document.createElement('p');
                                    range = document.createRange();
                                    range.selectNodeContents(blockElement);
                                    range.collapse(false);
                                }
                            } else {
                                // Select the found block element
                                range = document.createRange();
                                range.selectNodeContents(blockElement);
                            }
                            
                            // Set selection
                            selection.removeAllRanges();
                            selection.addRange(range);
                            
                            // Execute command
                            const success = document.execCommand(command, false, null);
                            
                            // If execCommand failed, manually create list
                            if(!success){
                                const listTag = command === 'insertUnorderedList' ? 'ul' : 'ol';
                                const listHtml = `<${listTag}><li>${blockElement.innerHTML || 'List item'}</li></${listTag}>`;
                                blockElement.outerHTML = listHtml;
                            }
                            
                            // Trigger content update
                            if(typeof updateRichTextContent === 'function'){
                                updateRichTextContent();
                            } else {
                                // Fallback: trigger input event
                                editor.dispatchEvent(new Event('input'));
                            }
                        }, 10);
                        
                        // Don't execute command here, it's done in setTimeout
                        return;
                    }
                    document.execCommand(command, false, null);
                }
            });
        });
        
        // Wire editor content changes
        editor.addEventListener('input', function() {
            // Content updated
        });
        editor.addEventListener('paste', function(e) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
        
        // Wire style select
        if(styleSelect){
            styleSelect.addEventListener('change', function() {
                // Style updated
            });
        }
        
        // Background type toggle
        if(backgroundTypeSelect){
            const colorContainer = editContent.querySelector('#edit-richtext-background-color-container');
            const imageContainer = editContent.querySelector('#edit-richtext-background-image-container');
            
            backgroundTypeSelect.addEventListener('change', function() {
                const bgType = this.value;
                if(colorContainer) colorContainer.style.display = bgType === 'color' ? 'block' : 'none';
                if(imageContainer) imageContainer.style.display = bgType === 'image' ? 'block' : 'none';
            });
        }
        
        // Background color sync
        if(backgroundColorInput && backgroundColorText){
            backgroundColorInput.addEventListener('input', function() {
                if(backgroundColorText) backgroundColorText.value = this.value;
            });
            backgroundColorText.addEventListener('input', function() {
                if(backgroundColorInput && /^#[0-9A-F]{6}$/i.test(this.value)){
                    backgroundColorInput.value = this.value;
                }
            });
        }
    }
    
    function setupNestedImageEditor(){
        const editContent = document.getElementById('edit-nested-block-content');
        if(!editContent) return;
        
        const srcInput = editContent.querySelector('#edit-image-src');
        const altInput = editContent.querySelector('#edit-image-alt');
        const captionInput = editContent.querySelector('#edit-image-caption');
        const widthSelect = editContent.querySelector('#edit-image-width');
        const previewContainer = editContent.querySelector('#edit-image-preview-container');
        let previewImg = editContent.querySelector('#edit-image-preview');
        
        if(!srcInput) return;
        
        function updatePreview(){
            const src = srcInput.value;
            if(src && previewContainer){
                if(!previewImg){
                    previewImg = document.createElement('img');
                    previewImg.id = 'edit-image-preview';
                    previewImg.className = 'max-w-full h-32 object-contain border rounded';
                    previewImg.alt = 'Preview';
                    previewImg.onerror = function() {
                        this.style.display = 'none';
                        const errorDiv = this.nextElementSibling;
                        if(errorDiv) errorDiv.style.display = 'block';
                    };
                    
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'hidden text-xs text-red-500 mt-1';
                    errorDiv.textContent = 'Image not found';
                    
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(previewImg);
                    previewContainer.appendChild(errorDiv);
                }
                previewImg.src = src;
                previewContainer.style.display = 'block';
            } else if(previewContainer){
                previewContainer.style.display = 'none';
            }
        }
        
        // Update preview when src changes
        if(srcInput){
            srcInput.addEventListener('input', updatePreview);
        }
        
        // Initial preview
        updatePreview();
    }
    
    function closeNestedBlockEditModal(){
        const editModal = document.getElementById('edit-nested-block-modal');
        if(editModal){
            editModal.classList.add('hidden');
            editModal.classList.remove('flex');
            editModal.style.display = 'none';
        }
        currentNestedBlockContext = null;
    }
    
    function generateNestedBlockEditor(blockType, content){
        content = content || {};
        
        // Based on block type, generate appropriate editor
        switch(blockType){
            case 'heading': {
                const fontColor = content.fontColor || '#000000';
                const backgroundColor = content.backgroundColor || '';
                const backgroundImage = content.backgroundImage || '';
                const backgroundType = content.backgroundType || 'none';
                const height = content.height || 'auto';
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Heading Text</label>
                            <input type="text" id="edit-heading-text" value="${(content.text || '').replace(/"/g, '&quot;')}" class="w-full border rounded px-3 py-2">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Level</label>
                            <select id="edit-heading-level" class="w-full border rounded px-3 py-2">
                                <option value="h1" ${(content.level || 'h2') === 'h1' ? 'selected' : ''}>H1</option>
                                <option value="h2" ${(content.level || 'h2') === 'h2' ? 'selected' : ''}>H2</option>
                                <option value="h3" ${(content.level || 'h2') === 'h3' ? 'selected' : ''}>H3</option>
                                <option value="h4" ${(content.level || 'h2') === 'h4' ? 'selected' : ''}>H4</option>
                                <option value="h5" ${(content.level || 'h2') === 'h5' ? 'selected' : ''}>H5</option>
                                <option value="h6" ${(content.level || 'h2') === 'h6' ? 'selected' : ''}>H6</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Alignment</label>
                            <select id="edit-heading-alignment" class="w-full border rounded px-3 py-2">
                                <option value="left" ${(content.alignment || 'left') === 'left' ? 'selected' : ''}>Left</option>
                                <option value="center" ${(content.alignment || 'left') === 'center' ? 'selected' : ''}>Center</option>
                                <option value="right" ${(content.alignment || 'left') === 'right' ? 'selected' : ''}>Right</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Font Color</label>
                            <div class="flex items-center gap-2">
                                <input type="color" id="edit-heading-font-color" value="${fontColor}" class="h-8 w-16 border rounded">
                                <input type="text" id="edit-heading-font-color-text" value="${fontColor}" class="flex-1 border rounded px-3 py-2" placeholder="#000000">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Background Type</label>
                            <select id="edit-heading-background-type" class="w-full border rounded px-3 py-2">
                                <option value="none" ${backgroundType === 'none' || (!backgroundType && !backgroundColor && !backgroundImage) ? 'selected' : ''}>None</option>
                                <option value="color" ${backgroundType === 'color' ? 'selected' : ''}>Color</option>
                                <option value="image" ${backgroundType === 'image' ? 'selected' : ''}>Image</option>
                            </select>
                        </div>
                        <div id="edit-heading-background-color-container" style="display: ${backgroundType === 'color' ? 'block' : 'none'};">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                            <div class="flex items-center gap-2">
                                <input type="color" id="edit-heading-background-color" value="${backgroundColor || '#ffffff'}" class="h-8 w-16 border rounded">
                                <input type="text" id="edit-heading-background-color-text" value="${backgroundColor || '#ffffff'}" class="flex-1 border rounded px-3 py-2" placeholder="#ffffff">
                            </div>
                        </div>
                        <div id="edit-heading-background-image-container" style="display: ${backgroundType === 'image' ? 'block' : 'none'};">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Background Image</label>
                            <input type="text" id="edit-heading-background-image" value="${backgroundImage}" class="w-full border rounded px-3 py-2" placeholder="Image URL">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Height</label>
                            <input type="text" id="edit-heading-height" value="${height}" class="w-full border rounded px-3 py-2" placeholder="auto, 100px, 50vh, etc.">
                            <p class="text-xs text-gray-500 mt-1">e.g., auto, 100px, 50vh, 10rem</p>
                        </div>
                    </div>
                `;
            }
            case 'richtext': {
                const bgType = content.backgroundType || 'none';
                const bgColor = content.backgroundColor || '';
                const bgImage = content.backgroundImage || '';
                const height = content.height || 'auto';
                const padding = content.padding || '';
                const htmlContent = content.html || '<p>Write something...</p>';
                const style = content.style || 'normal';
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Text Style</label>
                            <select id="edit-richtext-style" class="w-full border rounded px-3 py-2">
                                <option value="normal" ${style === 'normal' ? 'selected' : ''}>Normal</option>
                                <option value="large" ${style === 'large' ? 'selected' : ''}>Large</option>
                                <option value="small" ${style === 'small' ? 'selected' : ''}>Small</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Content</label>
                            <!-- WYSIWYG Toolbar -->
                            <div class="border border-gray-300 rounded-t-lg bg-gray-50 p-2 flex items-center gap-1 flex-wrap">
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="bold" title="Bold">
                                    <i class="fas fa-bold"></i>
                                </button>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="italic" title="Italic">
                                    <i class="fas fa-italic"></i>
                                </button>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="underline" title="Underline">
                                    <i class="fas fa-underline"></i>
                                </button>
                                <div class="w-px h-4 bg-gray-300"></div>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="formatBlock" data-arg="h1" title="Heading 1">H1</button>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="formatBlock" data-arg="h2" title="Heading 2">H2</button>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="formatBlock" data-arg="p" title="Paragraph">P</button>
                                <div class="w-px h-4 bg-gray-300"></div>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="insertUnorderedList" title="Bullet List">
                                    <i class="fas fa-list-ul"></i>
                                </button>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="insertOrderedList" title="Numbered List">
                                    <i class="fas fa-list-ol"></i>
                                </button>
                                <div class="w-px h-4 bg-gray-300"></div>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn richtext-link-btn" title="Insert Link">
                                    <i class="fas fa-link"></i>
                                </button>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn richtext-table-btn" title="Insert Table">
                                    <i class="fas fa-table"></i>
                                </button>
                                <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="removeFormat" title="Remove Formatting">
                                    <i class="fas fa-remove-format"></i>
                                </button>
                            </div>
                            <!-- WYSIWYG Editor -->
                            <div id="edit-richtext-html" class="richtext-editor border border-t-0 border-gray-300 rounded-b-lg p-3 min-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                 contenteditable="true" 
                                 data-placeholder="Write something...">${htmlContent}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Background Type</label>
                            <select id="edit-richtext-background-type" class="w-full border rounded px-3 py-2">
                                <option value="none" ${bgType === 'none' || (!bgType && !bgColor && !bgImage) ? 'selected' : ''}>None</option>
                                <option value="color" ${bgType === 'color' ? 'selected' : ''}>Color</option>
                                <option value="image" ${bgType === 'image' ? 'selected' : ''}>Image</option>
                            </select>
                        </div>
                        <div id="edit-richtext-background-color-container" style="display: ${bgType === 'color' ? 'block' : 'none'};">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                            <div class="flex items-center gap-2">
                                <input type="color" id="edit-richtext-background-color" value="${bgColor || '#ffffff'}" class="h-8 w-16 border rounded">
                                <input type="text" id="edit-richtext-background-color-text" value="${bgColor || '#ffffff'}" class="flex-1 border rounded px-3 py-2" placeholder="#ffffff">
                            </div>
                        </div>
                        <div id="edit-richtext-background-image-container" style="display: ${bgType === 'image' ? 'block' : 'none'};">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Background Image</label>
                            <input type="text" id="edit-richtext-background-image" value="${bgImage.replace(/"/g, '&quot;')}" class="w-full border rounded px-3 py-2" placeholder="Image URL">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Height</label>
                            <input type="text" id="edit-richtext-height" value="${height.replace(/"/g, '&quot;')}" class="w-full border rounded px-3 py-2" placeholder="auto, 100px, 50vh, etc.">
                            <p class="text-xs text-gray-500 mt-1">e.g., auto, 100px, 50vh, 10rem</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Padding</label>
                            <input type="text" id="edit-richtext-padding" value="${padding.replace(/"/g, '&quot;')}" class="w-full border rounded px-3 py-2" placeholder="20px, 1rem 2rem, etc.">
                            <p class="text-xs text-gray-500 mt-1">e.g., 20px, 1rem 2rem, 10px 20px 10px 20px</p>
                        </div>
                    </div>
                `;
            }
            case 'image': {
                const src = (content.src || '').replace(/"/g, '&quot;');
                const alt = (content.alt || '').replace(/"/g, '&quot;');
                const caption = (content.caption || '').replace(/"/g, '&quot;');
                const width = content.width || 'full';
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Image URL or Path</label>
                            <input type="text" id="edit-image-src" value="${src}" class="w-full border rounded px-3 py-2" placeholder="/path/to/image.jpg">
                            <p class="text-xs text-gray-500 mt-1">Enter a URL or use the file manager from the main builder</p>
                            ${src ? `<div class="mt-2" id="edit-image-preview-container"><img src="${src}" alt="Preview" id="edit-image-preview" class="max-w-full h-32 object-contain border rounded" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div class="hidden text-xs text-red-500 mt-1">Image not found</div></div>` : '<div class="mt-2" id="edit-image-preview-container" style="display:none;"></div>'}
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Alt Text</label>
                            <input type="text" id="edit-image-alt" value="${alt}" class="w-full border rounded px-3 py-2" placeholder="Description of image">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Caption (Optional)</label>
                            <input type="text" id="edit-image-caption" value="${caption}" class="w-full border rounded px-3 py-2" placeholder="Optional caption">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Width</label>
                            <select id="edit-image-width" class="w-full border rounded px-3 py-2">
                                <option value="full" ${width === 'full' ? 'selected' : ''}>Full Width</option>
                                <option value="half" ${width === 'half' ? 'selected' : ''}>Half Width</option>
                                <option value="third" ${width === 'third' ? 'selected' : ''}>One Third</option>
                            </select>
                        </div>
                    </div>
                `;
            }
            case 'button':
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                            <input type="text" id="edit-button-text" value="${(content.text || '').replace(/"/g, '&quot;')}" class="w-full border rounded px-3 py-2">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">URL</label>
                            <input type="text" id="edit-button-url" value="${(content.url || '').replace(/"/g, '&quot;')}" class="w-full border rounded px-3 py-2">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Target</label>
                            <select id="edit-button-target" class="w-full border rounded px-3 py-2">
                                <option value="_self" ${(content.target || '_self') === '_self' ? 'selected' : ''}>Same Window</option>
                                <option value="_blank" ${(content.target || '_self') === '_blank' ? 'selected' : ''}>New Window</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Style</label>
                            <select id="edit-button-style" class="w-full border rounded px-3 py-2">
                                <option value="primary" ${(content.style || 'primary') === 'primary' ? 'selected' : ''}>Primary</option>
                                <option value="secondary" ${(content.style || 'primary') === 'secondary' ? 'selected' : ''}>Secondary</option>
                                <option value="danger" ${(content.style || 'primary') === 'danger' ? 'selected' : ''}>Danger</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Position</label>
                            <select id="edit-button-position" class="w-full border rounded px-3 py-2">
                                <option value="left" ${(content.position || 'left') === 'left' ? 'selected' : ''}>Left</option>
                                <option value="center" ${(content.position || 'left') === 'center' ? 'selected' : ''}>Center</option>
                                <option value="right" ${(content.position || 'left') === 'right' ? 'selected' : ''}>Right</option>
                            </select>
                        </div>
                    </div>
                `;
            case 'gallery':
                const images = content.images || [];
                const display = content.display || 'grid';
                const autoplay = content.autoplay || false;
                
                const imagesHtml = images.length > 0 ? images.map((img, idx) => {
                    const src = (img.src || '').replace(/"/g, '&quot;');
                    const alt = (img.alt || '').replace(/"/g, '&quot;');
                    return `
                        <div class="flex items-center gap-2 p-2 bg-gray-50 border rounded gallery-image-item" data-image-index="${idx}">
                            <div class="flex-1 grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs text-gray-600 mb-1">Image URL</label>
                                    <div class="flex gap-1 items-center lfm-url-field">
                                        <input type="text" value="${src}" class="flex-1 border rounded px-2 py-1 text-xs gallery-image-src" placeholder="/path/to/image.jpg">
                                        <button type="button" class="js-lfm-pick-image shrink-0 text-[10px] font-semibold text-[#0075de] px-1.5 py-0.5 border border-[#0075de]/30 rounded">Lib</button>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-600 mb-1">Alt Text</label>
                                    <input type="text" value="${alt}" class="w-full border rounded px-2 py-1 text-xs gallery-image-alt" placeholder="Alt text">
                                </div>
                            </div>
                            <button type="button" class="text-red-600 hover:text-red-800 gallery-remove-image-btn" data-image-index="${idx}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }).join('') : '<div class="text-xs text-gray-400 text-center py-4">No images yet</div>';
                
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Display Type</label>
                            <select id="edit-gallery-display" class="w-full border rounded px-3 py-2">
                                <option value="grid" ${display === 'grid' || !display ? 'selected' : ''}>Grid</option>
                                <option value="slider" ${display === 'slider' ? 'selected' : ''}>Slider</option>
                            </select>
                        </div>
                        <div id="edit-gallery-autoplay-container" style="display: ${display === 'slider' ? 'block' : 'none'};">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="edit-gallery-autoplay" ${autoplay ? 'checked' : ''}>
                                <span>Autoplay (slider only)</span>
                            </label>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Images</label>
                            <div id="edit-gallery-images-list" class="space-y-2">
                                ${imagesHtml}
                            </div>
                            <button type="button" id="edit-gallery-add-image" class="mt-2 text-blue-600 hover:text-blue-800 text-sm">
                                <i class="fas fa-plus mr-1"></i>Add Image
                            </button>
                        </div>
                    </div>
                `;
            default:
                return `
                    <div class="p-4 border rounded">
                        <p class="text-gray-600">Editor for "${blockType}" block type is not yet implemented.</p>
                        <textarea class="w-full mt-2 border rounded px-3 py-2 min-h-[200px]" id="edit-generic-content" placeholder="JSON content">${JSON.stringify(content, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                    </div>
                `;
        }
    }
    
    function saveNestedBlockEdit(){
        if(!currentNestedBlockContext) return;
        
        const {columnIndex, blockIndex, parentLi, blockType} = currentNestedBlockContext;
        const contentInput = parentLi.querySelector('.column-content-input');
        
        if(!contentInput) return;
        
        try {
            const currentContent = JSON.parse(contentInput.value || '{}');
            const columns = currentContent.columns || [];
            
            if(!columns[columnIndex]) columns[columnIndex] = {blocks: []};
            if(!columns[columnIndex].blocks) columns[columnIndex].blocks = [];
            if(!columns[columnIndex].blocks[blockIndex]) columns[columnIndex].blocks[blockIndex] = {type: blockType, content: {}};
            
            // Get updated content based on block type
            let updatedContent = {};
            switch(blockType){
                case 'heading':
                    const bgType = document.getElementById('edit-heading-background-type')?.value || 'none';
                    updatedContent = {
                        text: document.getElementById('edit-heading-text')?.value || '',
                        level: document.getElementById('edit-heading-level')?.value || 'h2',
                        alignment: document.getElementById('edit-heading-alignment')?.value || 'left',
                        fontColor: document.getElementById('edit-heading-font-color')?.value || '#000000',
                        backgroundType: bgType,
                        backgroundColor: bgType === 'color' ? (document.getElementById('edit-heading-background-color')?.value || '') : '',
                        backgroundImage: bgType === 'image' ? (document.getElementById('edit-heading-background-image')?.value || '') : '',
                        height: document.getElementById('edit-heading-height')?.value || 'auto'
                    };
                    break;
                case 'richtext':
                    const richtextBgType = document.getElementById('edit-richtext-background-type')?.value || 'none';
                    const richtextEditor = document.getElementById('edit-richtext-html');
                    // Get HTML from contenteditable div, not textarea
                    let richtextHtml = '';
                    if(richtextEditor){
                        // For contenteditable div, get innerHTML
                        richtextHtml = richtextEditor.innerHTML || '';
                        // Clean up empty paragraphs
                        if(richtextHtml === '<p></p>' || richtextHtml === '<p><br></p>' || richtextHtml.trim() === ''){
                            richtextHtml = '<p>Write something...</p>';
                        }
                    }
                    updatedContent = {
                        html: richtextHtml || '<p>Write something...</p>',
                        style: document.getElementById('edit-richtext-style')?.value || 'normal',
                        backgroundType: richtextBgType,
                        backgroundColor: richtextBgType === 'color' ? (document.getElementById('edit-richtext-background-color')?.value || '') : '',
                        backgroundImage: richtextBgType === 'image' ? (document.getElementById('edit-richtext-background-image')?.value || '') : '',
                        height: document.getElementById('edit-richtext-height')?.value || 'auto',
                        padding: document.getElementById('edit-richtext-padding')?.value || ''
                    };
                    break;
                case 'image':
                    updatedContent = {
                        src: document.getElementById('edit-image-src')?.value || '',
                        alt: document.getElementById('edit-image-alt')?.value || '',
                        caption: document.getElementById('edit-image-caption')?.value || '',
                        width: document.getElementById('edit-image-width')?.value || 'full'
                    };
                    break;
                case 'button':
                    updatedContent = {
                        text: document.getElementById('edit-button-text')?.value || '',
                        url: document.getElementById('edit-button-url')?.value || '',
                        target: document.getElementById('edit-button-target')?.value || '_self',
                        style: document.getElementById('edit-button-style')?.value || 'primary',
                        position: document.getElementById('edit-button-position')?.value || 'left'
                    };
                    break;
                case 'gallery':
                    const images = [];
                    const imageItems = document.querySelectorAll('#edit-gallery-images-list .gallery-image-item');
                    imageItems.forEach(item => {
                        const src = item.querySelector('.gallery-image-src')?.value || '';
                        const alt = item.querySelector('.gallery-image-alt')?.value || '';
                        if(src){
                            images.push({src, alt});
                        }
                    });
                    updatedContent = {
                        images: images,
                        display: document.getElementById('edit-gallery-display')?.value || 'grid',
                        autoplay: document.getElementById('edit-gallery-autoplay')?.checked || false
                    };
                    break;
                default:
                    const genericContent = document.getElementById('edit-generic-content')?.value;
                    if(genericContent){
                        updatedContent = JSON.parse(genericContent);
                    }
            }
            
            // Update the block content
            columns[columnIndex].blocks[blockIndex].content = updatedContent;
            columns[columnIndex].blocks[blockIndex].type = blockType;
            
            // Save to content input
            contentInput.value = JSON.stringify({columns: columns});
            
            // Update preview
            const preview = parentLi.querySelector('.block-preview');
            if(preview) preview.setAttribute('data-content', contentInput.value);
            
            // Update the DOM element
            const editForm = parentLi.querySelector('.block-edit-form');
            const blocksList = editForm?.querySelector(`.column-blocks-list[data-column-index="${columnIndex}"]`);
            const blockItem = blocksList?.querySelector(`.nested-block-item:nth-child(${blockIndex + 1})`);
            if(blockItem){
                // Update both data attributes for consistency
                blockItem.setAttribute('data-block-content', JSON.stringify(updatedContent));
                blockItem.setAttribute('data-block-data', JSON.stringify({type: blockType, content: updatedContent}));
                blockItem.setAttribute('data-block-type', blockType);
            }
            
            // Refresh previews
            refreshAllPreviews();
            
            // Close modal
            closeNestedBlockEditModal();
        } catch(e){
            console.error('Error saving nested block edit:', e);
            alert('Error saving changes: ' + e.message);
        }
    }
    
    // Wire up nested block edit modal buttons
    const closeEditNestedBtn = document.getElementById('close-edit-nested-block');
    const cancelEditNestedBtn = document.getElementById('cancel-edit-nested-block');
    const saveEditNestedBtn = document.getElementById('save-edit-nested-block');
    const editNestedModal = document.getElementById('edit-nested-block-modal');
    
    if(closeEditNestedBtn) closeEditNestedBtn.addEventListener('click', closeNestedBlockEditModal);
    if(cancelEditNestedBtn) cancelEditNestedBtn.addEventListener('click', closeNestedBlockEditModal);
    if(saveEditNestedBtn) saveEditNestedBtn.addEventListener('click', saveNestedBlockEdit);
    if(editNestedModal){
        editNestedModal.addEventListener('click', function(e){
            if(e.target === editNestedModal){
                closeNestedBlockEditModal();
            }
        });
    }

    openBtns.forEach(btn => {
        btn.addEventListener('click', function(){
            const defaultWidth = this.getAttribute('data-default-width') || 'full';
            // Find the parent li element (the block that contains this "Add Block Below" button)
            const parentBlock = this.closest('li');
            openModal(defaultWidth, parentBlock);
        });
    });

    if(closeModalBtn){ closeModalBtn.addEventListener('click', closeModal); }
    if(modal){
        modal.addEventListener('click', function(e){ if(e.target === modal){ closeModal(); } });
    }

    function createTempBlockElement(type, contentJson, width){
        const li = document.createElement('li');
        const blockWidth = width || 'full';
        const widthClass = getWidthClass(blockWidth);
        li.className = `border rounded-lg p-3 ${widthClass}`;
        li.setAttribute('data-width', blockWidth);
        li.setAttribute('data-note', ''); // Initialize note attribute for temp blocks
        li.setAttribute('data-visibility-rules', '{}'); // Initialize visibility rules attribute for temp blocks
        // Generate unique ID for temp blocks so they can be referenced when adding nested blocks
        const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        li.id = tempId;
        li.setAttribute('data-temp-id', tempId);
        // No data-block-id on purpose to keep it client-only

        let editorHtml = '';
        if(type === 'divider'){
            try {
                const content = JSON.parse(contentJson);
                const style = content.style || 'solid';
                const color = content.color || '#ccc';
                const divWidth = content.width || 'full';
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Line Style</label>
                                <select class="w-full border rounded px-2 py-1 text-sm divider-style-select">
                                    <option value="solid" ${style === 'solid' ? 'selected' : ''}>Solid</option>
                                    <option value="dashed" ${style === 'dashed' ? 'selected' : ''}>Dashed</option>
                                    <option value="dotted" ${style === 'dotted' ? 'selected' : ''}>Dotted</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" value="${color}" class="h-8 w-16 border rounded divider-color-input">
                                    <input type="text" value="${color}" class="flex-1 border rounded px-2 py-1 text-sm divider-color-text" placeholder="#ccc">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Width</label>
                                <select class="w-full border rounded px-2 py-1 text-sm divider-width-select">
                                    <option value="full" ${divWidth === 'full' ? 'selected' : ''}>Full Width</option>
                                    <option value="half" ${divWidth === 'half' ? 'selected' : ''}>Half Width</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="divider-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'spacer'){
            try {
                const content = JSON.parse(contentJson);
                const currentHeight = content.height || '40px';
                const currentSize = content.size || null;
                const heightValue = parseInt(currentHeight.replace('px', '')) || 40;
                const sizeMap = {small: '20px', medium: '40px', large: '60px', xlarge: '80px'};
                let selectedSize = currentSize;
                if(!selectedSize && currentHeight){
                    const reverseMap = {'20px': 'small', '40px': 'medium', '60px': 'large', '80px': 'xlarge'};
                    selectedSize = reverseMap[currentHeight] || '';
                }
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Size (Quick Select)</label>
                                <select class="w-full border rounded px-2 py-1 text-sm spacer-size-select">
                                    <option value="">Custom</option>
                                    <option value="small" ${selectedSize === 'small' ? 'selected' : ''}>Small (20px)</option>
                                    <option value="medium" ${selectedSize === 'medium' || (!selectedSize && currentHeight === '40px') ? 'selected' : ''}>Medium (40px)</option>
                                    <option value="large" ${selectedSize === 'large' ? 'selected' : ''}>Large (60px)</option>
                                    <option value="xlarge" ${selectedSize === 'xlarge' ? 'selected' : ''}>Extra Large (80px)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">
                                    Height: <span class="spacer-height-display">${currentHeight}</span>
                                </label>
                                <input type="range" min="10" max="200" step="5" value="${heightValue}" class="w-full spacer-height-slider">
                                <div class="flex items-center justify-between text-xs text-gray-500 mt-1">
                                    <span>10px</span>
                                    <span>200px</span>
                                </div>
                                <input type="text" value="${currentHeight}" class="w-full mt-2 border rounded px-2 py-1 text-sm spacer-height-text" placeholder="40px">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="spacer-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'gallery'){
            try {
                const content = JSON.parse(contentJson);
                const images = content.images || [];
                const display = content.display || 'grid';
                const autoplay = content.autoplay || false;
                
                const imagesHtml = images.length > 0 ? images.map((img, idx) => {
                    const src = img.src || '';
                    const alt = img.alt || '';
                    return `
                        <div class="flex items-center gap-2 p-2 bg-gray-50 border rounded gallery-image-item" data-image-index="${idx}">
                            <div class="flex-1 grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs text-gray-600 mb-1">Image URL</label>
                                    <div class="flex gap-1 items-center lfm-url-field">
                                        <input type="text" value="${src}" class="flex-1 border rounded px-2 py-1 text-xs gallery-image-src" placeholder="/path/to/image.jpg">
                                        <button type="button" class="js-lfm-pick-image shrink-0 text-[10px] font-semibold text-[#0075de] px-1.5 py-0.5 border border-[#0075de]/30 rounded">Lib</button>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-600 mb-1">Alt Text</label>
                                    <input type="text" value="${alt}" class="w-full border rounded px-2 py-1 text-xs gallery-image-alt" placeholder="Alt text">
                                </div>
                            </div>
                            ${src ? `<div class="w-16 h-16 border rounded overflow-hidden">
                                <img src="${src}" alt="Preview" class="w-full h-full object-cover gallery-image-preview">
                            </div>` : ''}
                            <button type="button" class="text-red-600 hover:text-red-800 gallery-remove-image-btn" data-image-index="${idx}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }).join('') : '<div class="text-xs text-gray-400 text-center py-4">No images yet</div>';
                
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Display Type</label>
                                <select class="w-full border rounded px-2 py-1 text-sm gallery-display-select">
                                    <option value="grid" ${display === 'grid' || !display ? 'selected' : ''}>Grid</option>
                                    <option value="slider" ${display === 'slider' ? 'selected' : ''}>Slider</option>
                                </select>
                            </div>
                            <div class="gallery-autoplay-container" style="display: ${display === 'slider' ? 'block' : 'none'};">
                                <label class="flex items-center gap-2 text-xs">
                                    <input type="checkbox" class="gallery-autoplay-checkbox" ${autoplay ? 'checked' : ''}>
                                    <span>Autoplay (slider only)</span>
                                </label>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-2">Images</label>
                                <div class="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center gallery-upload-area bg-gray-50">
                                    <i class="fas fa-folder-open text-2xl text-gray-400 mb-2"></i>
                                    <p class="text-xs text-gray-600">Use <strong>Add Image</strong>, then <strong>Lib</strong> on each row for the file manager</p>
                                </div>
                                <div class="mt-3 space-y-2 gallery-images-list">
                                    ${imagesHtml}
                                </div>
                                <button type="button" class="mt-2 text-blue-600 hover:text-blue-800 text-xs gallery-add-image-btn">
                                    <i class="fas fa-plus mr-1"></i>Add Image
                                </button>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="gallery-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'code'){
            try {
                const content = JSON.parse(contentJson);
                const code = content.code || '';
                editorHtml = `
                    <form class="space-y-2 block-edit-form">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Code / HTML</label>
                                <p class="text-xs text-gray-500 mb-2">⚠️ Warning: Use with caution. This allows direct HTML/JavaScript input.</p>
                                <textarea rows="10" class="w-full border rounded px-2 py-1 text-sm font-mono code-content-input" placeholder="Enter your HTML, CSS, or JavaScript code here..." style="font-family: 'Courier New', monospace;">${code}</textarea>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="code-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'map'){
            try {
                const content = JSON.parse(contentJson);
                const lat = content.latitude || 34.0522;
                const lng = content.longitude || -118.2437;
                const zoom = content.zoom || 12;
                const address = content.address || '';
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Address</label>
                                <input type="text" value="${address}" class="w-full border rounded px-2 py-1 text-sm map-address-input" placeholder="Enter address (e.g., 123 Main St, City)">
                                <p class="text-xs text-gray-500 mt-1">Enter an address to geocode, or use coordinates below</p>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
                                    <input type="number" step="any" value="${lat}" class="w-full border rounded px-2 py-1 text-sm map-latitude-input" placeholder="34.0522">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
                                    <input type="number" step="any" value="${lng}" class="w-full border rounded px-2 py-1 text-sm map-longitude-input" placeholder="-118.2437">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">
                                    Zoom Level: <span class="map-zoom-display">${zoom}</span>
                                </label>
                                <input type="range" min="1" max="20" step="1" value="${zoom}" class="w-full map-zoom-slider">
                                <div class="flex items-center justify-between text-xs text-gray-500 mt-1">
                                    <span>1 (World)</span>
                                    <span>20 (Street)</span>
                                </div>
                            </div>
                            <div class="text-xs text-gray-500 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                <i class="fas fa-info-circle mr-1"></i>
                                Note: To use Google Maps, you'll need to set up a Google Maps API key in your application settings.
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="map-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'testimonial'){
            try {
                const content = JSON.parse(contentJson);
                const quote = content.quote || 'Great service!';
                const author = content.author || 'Jane Doe';
                const source = content.source || 'Company X';
                const image = content.image || '';
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Quote</label>
                                <textarea rows="4" class="w-full border rounded px-2 py-1 text-sm testimonial-quote-input" placeholder="Enter the testimonial quote...">${quote}</textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Author Name</label>
                                    <input type="text" value="${author}" class="w-full border rounded px-2 py-1 text-sm testimonial-author-input" placeholder="Jane Doe">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Company/Source</label>
                                    <input type="text" value="${source}" class="w-full border rounded px-2 py-1 text-sm testimonial-source-input" placeholder="Company X">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Author Photo</label>
                                <div class="flex gap-2 items-center lfm-url-field">
                                    <input type="text" value="${image}" class="flex-1 border rounded px-2 py-1 text-sm testimonial-image-input" placeholder="Image URL from file manager">
                                    <button type="button" class="js-lfm-pick-image shrink-0 text-xs font-semibold text-[#0075de] whitespace-nowrap px-2 py-1 border border-[#0075de]/30 rounded">Library</button>
                                </div>
                                ${image ? `<div class="mt-2"><img src="${image}" alt="Author" class="max-w-full h-24 object-contain border rounded testimonial-image-preview" onerror="this.style.display='none';"></div>` : ''}
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="testimonial-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'button'){
            try {
                const content = JSON.parse(contentJson);
                const text = content.text || 'Click Me';
                const url = content.url || '/contact';
                const target = content.target || '_self';
                const style = content.style || 'primary';
                const position = content.position || 'left';
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Button Text</label>
                                <input type="text" value="${text}" class="w-full border rounded px-2 py-1 text-sm button-text-input" placeholder="Click Me">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">URL</label>
                                <input type="text" value="${url}" class="w-full border rounded px-2 py-1 text-sm button-url-input" placeholder="/contact">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Link Target</label>
                                <select class="w-full border rounded px-2 py-1 text-sm button-target-select">
                                    <option value="_self" ${target === '_self' ? 'selected' : ''}>Same Window (_self)</option>
                                    <option value="_blank" ${target === '_blank' ? 'selected' : ''}>New Window (_blank)</option>
                                    <option value="_parent" ${target === '_parent' ? 'selected' : ''}>Parent Frame (_parent)</option>
                                    <option value="_top" ${target === '_top' ? 'selected' : ''}>Top Frame (_top)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Button Style</label>
                                <select class="w-full border rounded px-2 py-1 text-sm button-style-select">
                                    <option value="primary" ${style === 'primary' ? 'selected' : ''}>Primary</option>
                                    <option value="secondary" ${style === 'secondary' ? 'selected' : ''}>Secondary</option>
                                    <option value="danger" ${style === 'danger' ? 'selected' : ''}>Danger</option>
                                    <option value="success" ${style === 'success' ? 'selected' : ''}>Success</option>
                                    <option value="warning" ${style === 'warning' ? 'selected' : ''}>Warning</option>
                                    <option value="outline" ${style === 'outline' ? 'selected' : ''}>Outline</option>
                                    <option value="link" ${style === 'link' ? 'selected' : ''}>Link</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Button Position</label>
                                <select class="w-full border rounded px-2 py-1 text-sm button-position-select">
                                    <option value="left" ${position === 'left' ? 'selected' : ''}>Left</option>
                                    <option value="center" ${position === 'center' ? 'selected' : ''}>Center</option>
                                    <option value="right" ${position === 'right' ? 'selected' : ''}>Right</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="button-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'video'){
            try {
                const content = JSON.parse(contentJson);
                const videoType = content.type || 'youtube';
                const id = content.id || '';
                const src = content.src || '';
                const autoplay = content.autoplay || false;
                const loop = content.loop || false;
                const mute = content.mute || false;
                const urlValue = videoType === 'vimeo' && id ? `https://vimeo.com/${id}` : (videoType === 'youtube' && id ? `https://youtube.com/watch?v=${id}` : '');
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Video Type</label>
                                <select class="w-full border rounded px-2 py-1 text-sm video-type-select">
                                    <option value="youtube" ${videoType === 'youtube' ? 'selected' : ''}>YouTube</option>
                                    <option value="vimeo" ${videoType === 'vimeo' ? 'selected' : ''}>Vimeo</option>
                                    <option value="self_hosted" ${videoType === 'self_hosted' ? 'selected' : ''}>Self-Hosted</option>
                                </select>
                            </div>
                            <div class="video-url-field" style="display: ${videoType === 'self_hosted' ? 'none' : 'block'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Video URL</label>
                                <input type="text" value="${urlValue}" class="w-full border rounded px-2 py-1 text-sm video-url-input" placeholder="https://youtube.com/watch?v=... or https://vimeo.com/...">
                                <p class="text-xs text-gray-500 mt-1">Paste YouTube or Vimeo URL</p>
                            </div>
                            <div class="video-src-field" style="display: ${videoType === 'self_hosted' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Video File Path</label>
                                <input type="text" value="${src}" class="w-full border rounded px-2 py-1 text-sm video-src-input" placeholder="/path/to/video.mp4">
                                <p class="text-xs text-gray-500 mt-1">Path to self-hosted video file</p>
                            </div>
                            <div>
                                <label class="flex items-center gap-2 text-xs">
                                    <input type="checkbox" class="video-autoplay-checkbox" ${autoplay ? 'checked' : ''}>
                                    <span>Autoplay</span>
                                </label>
                            </div>
                            <div>
                                <label class="flex items-center gap-2 text-xs">
                                    <input type="checkbox" class="video-loop-checkbox" ${loop ? 'checked' : ''}>
                                    <span>Loop</span>
                                </label>
                            </div>
                            <div>
                                <label class="flex items-center gap-2 text-xs">
                                    <input type="checkbox" class="video-mute-checkbox" ${mute ? 'checked' : ''}>
                                    <span>Muted</span>
                                </label>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="video-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'richtext'){
            try {
                const content = JSON.parse(contentJson);
                const htmlContent = content.html || '<p>Write something...</p>';
                const style = content.style || 'normal';
                const backgroundType = content.backgroundType || 'none';
                const backgroundColor = content.backgroundColor || '';
                const backgroundImage = content.backgroundImage || '';
                const height = content.height || 'auto';
                const padding = content.padding || '';
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Text Style</label>
                                <select class="w-full border rounded px-2 py-1 text-sm richtext-style-select">
                                    <option value="normal" ${style === 'normal' ? 'selected' : ''}>Normal</option>
                                    <option value="large" ${style === 'large' ? 'selected' : ''}>Large</option>
                                    <option value="small" ${style === 'small' ? 'selected' : ''}>Small</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Content</label>
                                <!-- WYSIWYG Toolbar -->
                                <div class="border border-gray-300 rounded-t-lg bg-gray-50 p-2 flex items-center gap-1 flex-wrap">
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="bold" title="Bold">
                                        <i class="fas fa-bold"></i>
                                    </button>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="italic" title="Italic">
                                        <i class="fas fa-italic"></i>
                                    </button>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="underline" title="Underline">
                                        <i class="fas fa-underline"></i>
                                    </button>
                                    <div class="w-px h-4 bg-gray-300"></div>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="formatBlock" data-arg="h1" title="Heading 1">H1</button>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="formatBlock" data-arg="h2" title="Heading 2">H2</button>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="formatBlock" data-arg="p" title="Paragraph">P</button>
                                    <div class="w-px h-4 bg-gray-300"></div>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="insertUnorderedList" title="Bullet List">
                                        <i class="fas fa-list-ul"></i>
                                    </button>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="insertOrderedList" title="Numbered List">
                                        <i class="fas fa-list-ol"></i>
                                    </button>
                                    <div class="w-px h-4 bg-gray-300"></div>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn richtext-link-btn" title="Insert Link">
                                        <i class="fas fa-link"></i>
                                    </button>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn richtext-table-btn" title="Insert Table">
                                        <i class="fas fa-table"></i>
                                    </button>
                                    <button type="button" class="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded text-xs richtext-toolbar-btn" data-command="removeFormat" title="Remove Formatting">
                                        <i class="fas fa-remove-format"></i>
                                    </button>
                                </div>
                                <!-- WYSIWYG Editor -->
                                <div class="richtext-editor border border-t-0 border-gray-300 rounded-b-lg p-3 min-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                     contenteditable="true" 
                                     data-placeholder="Write something...">${htmlContent}</div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Type</label>
                                <select class="w-full border rounded px-2 py-1 text-sm richtext-background-type-select">
                                    <option value="none" ${backgroundType === 'none' || (!backgroundType && !backgroundColor && !backgroundImage) ? 'selected' : ''}>None</option>
                                    <option value="color" ${backgroundType === 'color' ? 'selected' : ''}>Color</option>
                                    <option value="image" ${backgroundType === 'image' ? 'selected' : ''}>Image</option>
                                </select>
                            </div>
                            <div class="richtext-background-color-container" style="display: ${backgroundType === 'color' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" value="${backgroundColor || '#ffffff'}" class="h-8 w-16 border rounded richtext-background-color-input">
                                    <input type="text" value="${backgroundColor || '#ffffff'}" class="flex-1 border rounded px-2 py-1 text-sm richtext-background-color-text" placeholder="#ffffff">
                                </div>
                            </div>
                            <div class="richtext-background-image-container" style="display: ${backgroundType === 'image' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Image</label>
                                <div class="border-2 border-dashed border-gray-300 rounded p-3 text-center richtext-upload-area bg-gray-50">
                                    ${backgroundImage ? `
                                        <img src="${backgroundImage}" alt="Background preview" class="max-h-32 mx-auto mb-2 richtext-image-preview">
                                    ` : `
                                        <i class="fas fa-folder-open text-3xl text-gray-400 mb-2"></i>
                                    `}
                                    <p class="text-xs text-gray-500">Use Library next to the URL field</p>
                                </div>
                                <div class="mt-2 flex gap-2 items-center lfm-url-field">
                                    <input type="text" value="${backgroundImage}" class="flex-1 border rounded px-2 py-1 text-sm richtext-background-image-input" placeholder="Image URL from file manager">
                                    <button type="button" class="js-lfm-pick-image shrink-0 text-xs font-semibold text-[#0075de] whitespace-nowrap px-2 py-1 border border-[#0075de]/30 rounded">Library</button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Height</label>
                                <input type="text" value="${height}" class="w-full border rounded px-2 py-1 text-sm richtext-height-input" placeholder="auto, 100px, 50vh, etc.">
                                <p class="text-xs text-gray-500 mt-1">e.g., auto, 100px, 50vh, 10rem</p>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Padding</label>
                                <input type="text" value="${padding}" class="w-full border rounded px-2 py-1 text-sm richtext-padding-input" placeholder="20px, 1rem 2rem, etc.">
                                <p class="text-xs text-gray-500 mt-1">e.g., 20px, 1rem 2rem, 10px 20px 10px 20px</p>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="richtext-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'heading'){
            try {
                const content = JSON.parse(contentJson);
                // Handle both numeric and string level formats
                let level = content.level || 'h2';
                if(typeof level === 'number'){
                    level = 'h' + level;
                } else if(typeof level === 'string' && !level.startsWith('h')){
                    level = 'h' + (parseInt(level) || 2);
                }
                if(!level.startsWith('h')) level = 'h2';
                const text = content.text || 'Your Heading Text';
                const alignment = content.alignment || 'left';
                const fontColor = content.fontColor || '#000000';
                const backgroundColor = content.backgroundColor || '';
                const backgroundImage = content.backgroundImage || '';
                const backgroundType = content.backgroundType || 'none';
                const height = content.height || 'auto';
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Heading Text</label>
                                <input type="text" value="${text}" class="w-full border rounded px-2 py-1 text-sm heading-text-input" placeholder="Your Heading Text">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Level</label>
                                <select class="w-full border rounded px-2 py-1 text-sm heading-level-select">
                                    <option value="h1" ${level === 'h1' ? 'selected' : ''}>H1 - Largest</option>
                                    <option value="h2" ${level === 'h2' || !content.level ? 'selected' : ''}>H2 - Large</option>
                                    <option value="h3" ${level === 'h3' ? 'selected' : ''}>H3 - Medium</option>
                                    <option value="h4" ${level === 'h4' ? 'selected' : ''}>H4 - Normal</option>
                                    <option value="h5" ${level === 'h5' ? 'selected' : ''}>H5 - Small</option>
                                    <option value="h6" ${level === 'h6' ? 'selected' : ''}>H6 - Smallest</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Alignment</label>
                                <select class="w-full border rounded px-2 py-1 text-sm heading-alignment-select">
                                    <option value="left" ${alignment === 'left' || !content.alignment ? 'selected' : ''}>Left</option>
                                    <option value="center" ${alignment === 'center' ? 'selected' : ''}>Center</option>
                                    <option value="right" ${alignment === 'right' ? 'selected' : ''}>Right</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Font Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" value="${fontColor}" class="h-8 w-16 border rounded heading-font-color-input">
                                    <input type="text" value="${fontColor}" class="flex-1 border rounded px-2 py-1 text-sm heading-font-color-text" placeholder="#000000">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Type</label>
                                <select class="w-full border rounded px-2 py-1 text-sm heading-background-type-select">
                                    <option value="none" ${backgroundType === 'none' || (!backgroundType && !backgroundColor && !backgroundImage) ? 'selected' : ''}>None</option>
                                    <option value="color" ${backgroundType === 'color' ? 'selected' : ''}>Color</option>
                                    <option value="image" ${backgroundType === 'image' ? 'selected' : ''}>Image</option>
                                </select>
                            </div>
                            <div class="heading-background-color-container" style="display: ${backgroundType === 'color' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" value="${backgroundColor || '#ffffff'}" class="h-8 w-16 border rounded heading-background-color-input">
                                    <input type="text" value="${backgroundColor || '#ffffff'}" class="flex-1 border rounded px-2 py-1 text-sm heading-background-color-text" placeholder="#ffffff">
                                </div>
                            </div>
                            <div class="heading-background-image-container" style="display: ${backgroundType === 'image' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Image</label>
                                <div class="border-2 border-dashed border-gray-300 rounded p-3 text-center heading-upload-area bg-gray-50">
                                    ${backgroundImage ? `
                                        <img src="${backgroundImage}" alt="Background preview" class="max-h-32 mx-auto mb-2 heading-image-preview">
                                    ` : `
                                        <i class="fas fa-folder-open text-3xl text-gray-400 mb-2"></i>
                                    `}
                                    <p class="text-xs text-gray-500">Use Library next to the URL field</p>
                                </div>
                                <div class="mt-2 flex gap-2 items-center lfm-url-field">
                                    <input type="text" value="${backgroundImage}" class="flex-1 border rounded px-2 py-1 text-sm heading-background-image-input" placeholder="Image URL from file manager">
                                    <button type="button" class="js-lfm-pick-image shrink-0 text-xs font-semibold text-[#0075de] whitespace-nowrap px-2 py-1 border border-[#0075de]/30 rounded">Library</button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Height</label>
                                <input type="text" value="${height}" class="w-full border rounded px-2 py-1 text-sm heading-height-input" placeholder="auto, 100px, 50vh, etc.">
                                <p class="text-xs text-gray-500 mt-1">e.g., auto, 100px, 50vh, 10rem</p>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="heading-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'two_column' || type === 'three_column'){
            try {
                const content = JSON.parse(contentJson);
                const columns = content.columns || [];
                const numColumns = type === 'two_column' ? 2 : 3;
                // Ensure we have the right number of columns
                while(columns.length < numColumns){
                    columns.push({blocks: []});
                }
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div class="text-xs font-medium text-gray-700 mb-2">
                                ${type === 'two_column' ? 'Two' : 'Three'} Column Layout Editor
                            </div>
                            <div class="grid ${type === 'two_column' ? 'grid-cols-2' : 'grid-cols-3'} gap-3">
                                ${columns.map((col, colIdx) => `
                                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-3 min-h-[200px] column-editor" data-column-index="${colIdx}">
                                        <div class="text-xs font-medium text-gray-700 mb-2 flex items-center justify-between">
                                            <span>Column ${colIdx + 1}</span>
                                            <button type="button" class="text-blue-600 hover:text-blue-800 text-xs column-add-block-btn" data-column-index="${colIdx}">
                                                <i class="fas fa-plus mr-1"></i>Add Block
                                            </button>
                                        </div>
                                        <div class="column-blocks-list space-y-2" data-column-index="${colIdx}">
                                            ${(col.blocks || []).length > 0 ? 
                                                (col.blocks || []).map((block, blockIdx) => `
                                                    <div class="p-2 bg-gray-50 border rounded text-xs nested-block-item">
                                                        <div class="flex items-center justify-between">
                                                            <span class="font-medium">${(block.type || 'unknown').replace('_', ' ').replace(/\\b\\w/g, c => c.toUpperCase())}</span>
                                                            <button type="button" class="text-red-600 hover:text-red-800 nested-block-remove-btn" data-column-index="${colIdx}" data-block-index="${blockIdx}">
                                                                <i class="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                `).join('') :
                                                '<div class="text-xs text-gray-400 text-center py-4">No blocks yet</div>'
                                            }
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                Note: Click "Add Block" to add blocks to each column. Blocks are nested within columns.
                            </p>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="column-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'image'){
            try {
                const content = JSON.parse(contentJson);
                const src = content.src || '';
                const alt = content.alt || '';
                const caption = content.caption || '';
                const width = content.width || 'full';
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Image URL or Path</label>
                                <div class="flex gap-2 items-center lfm-url-field">
                                    <input type="text" value="${src}" class="flex-1 border rounded px-2 py-1 text-sm image-src-input" placeholder="/path/to/image.jpg">
                                    <button type="button" class="js-lfm-pick-image shrink-0 text-xs font-semibold text-[#0075de] whitespace-nowrap px-2 py-1 border border-[#0075de]/30 rounded">Library</button>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">Enter a URL or use Library</p>
                                ${src ? `<div class="mt-2"><img src="${src}" alt="Preview" class="max-w-full h-32 object-contain border rounded image-preview"></div>` : ''}
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Alt Text</label>
                                <input type="text" value="${alt}" class="w-full border rounded px-2 py-1 text-sm image-alt-input" placeholder="Description of image">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Caption (Optional)</label>
                                <input type="text" value="${caption}" class="w-full border rounded px-2 py-1 text-sm image-caption-input" placeholder="Optional caption">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Width</label>
                                <select class="w-full border rounded px-2 py-1 text-sm image-width-select">
                                    <option value="full" ${width === 'full' ? 'selected' : ''}>Full Width</option>
                                    <option value="half" ${width === 'half' ? 'selected' : ''}>Half Width</option>
                                    <option value="third" ${width === 'third' ? 'selected' : ''}>One Third</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="image-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        } else if(type === 'hero_section'){
            try {
                const content = JSON.parse(contentJson);
                const heading = content.heading || 'Welcome';
                const subheading = content.subheading || '';
                const backgroundType = content.background_type || 'color';
                const backgroundImageUrl = content.background_image_url || '';
                const backgroundVideoUrl = content.background_video_url || '';
                const backgroundColor = content.background_color || '#000000';
                const overlayColor = content.overlay_color || '#000000';
                const overlayOpacity = content.overlay_opacity ?? 0.5;
                const buttonText = content.button_text || '';
                const buttonUrl = content.button_url || '';
                const buttonStyle = content.button_style || '';
                const buttonTarget = content.button_target || '_self';
                const alignment = content.alignment || 'center';
                const height = content.height || 'medium';
                const textColor = content.text_color || '#ffffff';
                
                editorHtml = `
                    <form class="space-y-2 block-edit-form hidden">
                        <div class="space-y-3 p-3 bg-white border rounded">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Heading *</label>
                                <input type="text" name="hero-heading" value="${heading.replace(/"/g, '&quot;')}" 
                                    class="w-full border rounded px-2 py-1 text-sm hero-heading-input" 
                                    placeholder="Welcome">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Subheading</label>
                                <input type="text" name="hero-subheading" value="${subheading.replace(/"/g, '&quot;')}" 
                                    class="w-full border rounded px-2 py-1 text-sm hero-subheading-input" 
                                    placeholder="Secondary text/slogan">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Type *</label>
                                <select name="hero-background-type" class="w-full border rounded px-2 py-1 text-sm hero-background-type-select">
                                    <option value="image" ${backgroundType === 'image' ? 'selected' : ''}>Image</option>
                                    <option value="video" ${backgroundType === 'video' ? 'selected' : ''}>Video</option>
                                    <option value="color" ${backgroundType === 'color' ? 'selected' : ''}>Color</option>
                                </select>
                            </div>
                            <div class="hero-background-image-container" style="display: ${backgroundType === 'image' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Image URL</label>
                                <div class="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hero-upload-area bg-gray-50">
                                    ${backgroundImageUrl ? `<img src="${backgroundImageUrl.replace(/"/g, '&quot;')}" alt="Background preview" class="max-h-32 mx-auto mb-2 hero-image-preview rounded">` : `<i class="fas fa-folder-open text-2xl text-gray-400 mb-2"></i>`}
                                    <p class="text-xs text-gray-500">Use Library below</p>
                                </div>
                                <div class="mt-2 flex gap-2 items-center lfm-url-field">
                                    <input type="text" name="hero-background-image-url" value="${backgroundImageUrl.replace(/"/g, '&quot;')}" 
                                        class="flex-1 border rounded px-2 py-1 text-sm hero-background-image-url-input" 
                                        placeholder="URL from file manager">
                                    <button type="button" class="js-lfm-pick-image shrink-0 text-xs font-semibold text-[#0075de] whitespace-nowrap px-2 py-1 border border-[#0075de]/30 rounded">Library</button>
                                </div>
                            </div>
                            <div class="hero-background-video-container" style="display: ${backgroundType === 'video' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Video URL</label>
                                <input type="text" name="hero-background-video-url" value="${backgroundVideoUrl.replace(/"/g, '&quot;')}" 
                                    class="w-full border rounded px-2 py-1 text-sm hero-background-video-url-input" 
                                    placeholder="https://example.com/video.mp4">
                            </div>
                            <div class="hero-background-color-container" style="display: ${backgroundType === 'color' ? 'block' : 'none'};">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Background Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" name="hero-background-color" value="${backgroundColor}" class="h-8 w-16 border rounded hero-background-color-input">
                                    <input type="text" value="${backgroundColor}" class="flex-1 border rounded px-2 py-1 text-sm hero-background-color-text" placeholder="#000000">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Overlay Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" name="hero-overlay-color" value="${overlayColor}" class="h-8 w-16 border rounded hero-overlay-color-input">
                                    <input type="text" value="${overlayColor}" class="flex-1 border rounded px-2 py-1 text-sm hero-overlay-color-text" placeholder="#000000">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Overlay Opacity (0.0-1.0)</label>
                                <input type="number" step="0.1" min="0" max="1" name="hero-overlay-opacity" value="${overlayOpacity}" 
                                    class="w-full border rounded px-2 py-1 text-sm hero-overlay-opacity-input">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Button Text</label>
                                <input type="text" name="hero-button-text" value="${buttonText.replace(/"/g, '&quot;')}" 
                                    class="w-full border rounded px-2 py-1 text-sm hero-button-text-input" 
                                    placeholder="Get Started">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Button URL</label>
                                <input type="text" name="hero-button-url" value="${buttonUrl.replace(/"/g, '&quot;')}" 
                                    class="w-full border rounded px-2 py-1 text-sm hero-button-url-input" 
                                    placeholder="/contact">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Button Style</label>
                                <input type="text" name="hero-button-style" value="${buttonStyle.replace(/"/g, '&quot;')}" 
                                    class="w-full border rounded px-2 py-1 text-sm hero-button-style-input" 
                                    placeholder="CSS class or identifier">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Button Target</label>
                                <select name="hero-button-target" class="w-full border rounded px-2 py-1 text-sm hero-button-target-select">
                                    <option value="_self" ${buttonTarget === '_self' ? 'selected' : ''}>Same Window (_self)</option>
                                    <option value="_blank" ${buttonTarget === '_blank' ? 'selected' : ''}>New Window (_blank)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Alignment *</label>
                                <select name="hero-alignment" class="w-full border rounded px-2 py-1 text-sm hero-alignment-select">
                                    <option value="left" ${alignment === 'left' ? 'selected' : ''}>Left</option>
                                    <option value="center" ${alignment === 'center' ? 'selected' : ''}>Center</option>
                                    <option value="right" ${alignment === 'right' ? 'selected' : ''}>Right</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Height</label>
                                <select name="hero-height" class="w-full border rounded px-2 py-1 text-sm hero-height-select">
                                    <option value="small" ${height === 'small' ? 'selected' : ''}>Small</option>
                                    <option value="medium" ${height === 'medium' ? 'selected' : ''}>Medium</option>
                                    <option value="large" ${height === 'large' ? 'selected' : ''}>Large</option>
                                    <option value="full_screen" ${height === 'full_screen' ? 'selected' : ''}>Full Screen</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Text Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" name="hero-text-color" value="${textColor}" class="h-8 w-16 border rounded hero-text-color-input">
                                    <input type="text" value="${textColor}" class="flex-1 border rounded px-2 py-1 text-sm hero-text-color-text" placeholder="#ffffff">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">Custom CSS Classes</label>
                                <input type="text" name="custom-classes" value="${(content.custom_classes || '').replace(/"/g, "&quot;")}" 
                                    class="w-full border rounded px-2 py-1 text-sm custom-classes-input" 
                                    placeholder="e.g., my-class another-class">
                                <p class="text-xs text-gray-500 mt-1">Add custom CSS classes separated by spaces</p>
                            </div>
                        </div>
                        <input type="hidden" class="hero-content-input" value='${contentJson.replace(/'/g, "&#39;")}'>
                    </form>
                `;
            } catch(e){
                editorHtml = '';
            }
        }

        li.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <!-- Bulk Selection Checkbox -->
                    <input type="checkbox" class="block-select-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" title="Select block">
                    <span class="cursor-move text-gray-400" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
                    <span class="text-sm font-medium text-gray-700">${type.replace('_',' ').replace(/\b\w/g, c=>c.toUpperCase())}</span>
                    <!-- Block Note Indicator -->
                    <button type="button" class="block-note-btn text-gray-400 hover:text-yellow-600 text-xs" title="Add note" data-temp-id="${tempId}">
                        <i class="fas fa-sticky-note"></i>
                    </button>
                    <!-- Visibility Rules Indicator -->
                    <button type="button" class="block-visibility-rules-btn text-gray-400 hover:text-blue-600 text-xs" title="Set visibility rules" data-temp-id="${tempId}">
                        <i class="fas fa-eye-slash"></i>
                    </button>
                    <div class="flex items-center gap-1 text-xs">
                        <label class="text-gray-600">Width</label>
                        <select class="border rounded px-1 py-0.5 temp-width">
                            <option value="full" ${blockWidth === 'full' ? 'selected' : ''}>Full width</option>
                            <option value="two-thirds" ${blockWidth === 'two-thirds' ? 'selected' : ''}>Two-thirds</option>
                            <option value="half" ${blockWidth === 'half' ? 'selected' : ''}>Half width</option>
                            <option value="third" ${blockWidth === 'third' ? 'selected' : ''}>One third</option>
                            <option value="quarter" ${blockWidth === 'quarter' ? 'selected' : ''}>One quarter</option>
                        </select>
                    </div>
                    <!-- Visibility Toggle -->
                    <button type="button" class="block-toggle-visibility-btn text-gray-400 hover:text-gray-600 text-xs" title="Collapse/Expand block">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="block-lock-btn inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-gray-50 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 border border-gray-200 hover:border-yellow-300 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow flex-shrink-0" title="Lock/Unlock Block" data-temp-id="${tempId}">
                        <i class="fas fa-lock text-xs"></i>
                        <i class="fas fa-lock-open text-xs"></i>
                    </button>
                    <button type="button" class="temp-duplicate-btn inline-flex items-center justify-center w-9 h-9 rounded-md bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-300 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow" title="Duplicate Block">
                        <i class="fas fa-copy text-xs"></i>
                    </button>
                    <button type="button" class="block-edit-toggle-btn inline-flex items-center justify-center w-9 h-9 rounded-md bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-300 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow" data-block-type="${type}" title="Edit Block">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                    <button type="button" class="temp-remove inline-flex items-center justify-center w-9 h-9 rounded-md bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-300 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow" title="Remove Block">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
            <div class="mt-3 block-content-wrapper ${getContentWidthClass(blockWidth)}">
                ${editorHtml}
                <div class="p-3 border rounded bg-gray-50 text-sm block-preview cursor-pointer hover:bg-gray-100 transition-colors" data-type="${type}" data-content='${contentJson.replace(/'/g, "&#39;")}'></div>
                <div class="mt-3 pt-3 border-t border-gray-200">
                    <button type="button" class="w-full px-3 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 text-sm text-blue-600 font-medium open-add-block" data-default-width="full">
                        <i class="fas fa-plus mr-2"></i>Add Block Below
                    </button>
                </div>
            </div>
        `;

        // Wire remove
        li.querySelector('.temp-remove').addEventListener('click', () => {
            li.parentNode && li.parentNode.removeChild(li);
            refreshAllPreviews();
            updateOrders(false);
            updateEmptyMessage();
        });
        // Wire duplicate
        li.querySelector('.temp-duplicate-btn').addEventListener('click', () => {
            duplicateBlock(li);
        });
        // Wire width change (updates col span)
        li.querySelector('.temp-width').addEventListener('change', (e) => {
            const val = e.target.value || 'full';
            li.setAttribute('data-width', val);
            updateBlockWidthClasses(li, val);
            
            // Mark as unsaved for auto-save
            if (typeof window.AutoSaveManager !== 'undefined' && !HistoryManager.isExecuting) {
                window.AutoSaveManager.markUnsaved();
            }
        });
        // Wire add block button inside this block
        const addBlockBtn = li.querySelector('.open-add-block');
        if(addBlockBtn) {
            addBlockBtn.addEventListener('click', function(){
                const defaultWidth = this.getAttribute('data-default-width') || 'full';
                // Find the parent li element (the block that contains this "Add Block Below" button)
                const parentBlock = this.closest('li');
                openModal(defaultWidth, parentBlock);
            });
        }

        // Wire divider editor if present
        if(type === 'divider'){
            setupDividerEditor(li);
        } else if(type === 'spacer'){
            setupSpacerEditor(li);
        } else if(type === 'button'){
            setupButtonEditor(li);
        } else if(type === 'map'){
            setupMapEditor(li);
        } else if(type === 'testimonial'){
            setupTestimonialEditor(li);
        } else if(type === 'video'){
            setupVideoEditor(li);
        } else if(type === 'richtext'){
            setupRichTextEditor(li);
        } else if(type === 'image'){
            setupImageEditor(li);
        } else if(type === 'gallery'){
            setupGalleryEditor(li);
        } else if(type === 'heading'){
            setupHeadingEditor(li);
        } else if(type === 'hero_section'){
            setupHeroSectionEditor(li);
        } else if(type === 'two_column' || type === 'three_column'){
            setupColumnEditor(li);
        }

        // Initialize edit button icon for newly created block
        // New blocks start with edit form hidden, so icon should be edit/pencil
        updateEditButtonIcon(li, false);

        return li;
    }

    function duplicateBlock(li) {
        if (!li) return;
        
        // Prevent duplication of locked blocks
        const blockId = li.getAttribute('data-block-id');
        if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
            Swal.fire({
                icon: 'warning',
                title: 'Block is Locked',
                text: 'Cannot duplicate a locked block. Unlock it first.',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }
        
        // Save state before duplication
        HistoryManager.saveState();
        
        const preview = li.querySelector('.block-preview');
        if (!preview) return;
        
        // Get block type from preview
        const blockType = preview.getAttribute('data-type');
        if (!blockType) return;
        
        // Get width from data attribute or hidden input
        const widthInput = li.querySelector('.hidden-width-input');
        const width = widthInput ? widthInput.value : (li.getAttribute('data-width') || 'full');
        
        // Get content - prioritize edit form if open, otherwise use preview data
        let content = preview.getAttribute('data-content');
        
        // Try to get updated content from edit forms
        const editForm = li.querySelector('.block-edit-form');
        if (editForm && !editForm.classList.contains('hidden')) {
            const contentInput = editForm.querySelector('input[name="content"], textarea.block-content-input');
            if (contentInput && contentInput.value) {
                content = contentInput.value;
            }
            
            // Handle special block types with custom content inputs
            if (blockType === 'divider') {
                const dividerContentInput = editForm.querySelector('.divider-content-input');
                if (dividerContentInput && dividerContentInput.value) {
                    content = dividerContentInput.value;
                }
            } else if (blockType === 'spacer') {
                const spacerContentInput = editForm.querySelector('.spacer-content-input');
                if (spacerContentInput && spacerContentInput.value) {
                    content = spacerContentInput.value;
                }
            } else if (blockType === 'button') {
                const buttonContentInput = editForm.querySelector('.button-content-input');
                if (buttonContentInput && buttonContentInput.value) {
                    content = buttonContentInput.value;
                }
            } else if (blockType === 'map') {
                const mapContentInput = editForm.querySelector('.map-content-input');
                if (mapContentInput && mapContentInput.value) {
                    content = mapContentInput.value;
                }
            } else if (blockType === 'testimonial') {
                const testimonialContentInput = editForm.querySelector('.testimonial-content-input');
                if (testimonialContentInput && testimonialContentInput.value) {
                    content = testimonialContentInput.value;
                }
            } else if (blockType === 'video') {
                const videoContentInput = editForm.querySelector('.video-content-input');
                if (videoContentInput && videoContentInput.value) {
                    content = videoContentInput.value;
                }
            } else if (blockType === 'image') {
                const imageContentInput = editForm.querySelector('.image-content-input');
                if (imageContentInput && imageContentInput.value) {
                    content = imageContentInput.value;
                }
            } else if (blockType === 'gallery') {
                const galleryContentInput = editForm.querySelector('.gallery-content-input');
                if (galleryContentInput && galleryContentInput.value) {
                    content = galleryContentInput.value;
                }
            } else if (blockType === 'heading') {
                const headingContentInput = editForm.querySelector('.heading-content-input');
                if (headingContentInput && headingContentInput.value) {
                    content = headingContentInput.value;
                }
            } else if (blockType === 'richtext') {
                const richtextContentInput = editForm.querySelector('.richtext-content-input');
                if (richtextContentInput && richtextContentInput.value) {
                    content = richtextContentInput.value;
                }
            } else if (blockType === 'two_column' || blockType === 'three_column') {
                const columnContentInput = editForm.querySelector('.column-content-input');
                if (columnContentInput && columnContentInput.value) {
                    content = columnContentInput.value;
                }
            }
        }
        
        // Ensure content is a JSON string
        let contentJson = content || '{}';
        if (typeof contentJson !== 'string') {
            contentJson = JSON.stringify(contentJson);
        }
        
        // Create duplicate block and append to end of list
        const newBlock = createTempBlockElement(blockType, contentJson, width);
        const blocksList = document.getElementById('blocks-list');
        if (blocksList) {
            blocksList.appendChild(newBlock);
            attachDnD();
            refreshAllPreviews();
            updateOrders(false);
            updateEmptyMessage();
            
            // Save state after duplication
            HistoryManager.saveState();
        }
    }

    function setupColumnEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const contentInput = li.querySelector('.column-content-input');
        const addBlockBtns = li.querySelectorAll('.column-add-block-btn');
        const removeBlockBtns = li.querySelectorAll('.nested-block-remove-btn');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        function updateColumnContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const columns = currentContent.columns || [];
                
                // Update blocks from DOM
                editForm.querySelectorAll('.column-blocks-list').forEach(blocksList => {
                    const colIdx = parseInt(blocksList.getAttribute('data-column-index'));
                    if(!columns[colIdx]) columns[colIdx] = {blocks: []};
                    const blocks = Array.from(blocksList.querySelectorAll('.nested-block-item')).map(item => {
                        const blockData = item.getAttribute('data-block-data');
                        return blockData ? JSON.parse(blockData) : null;
                    }).filter(b => b !== null);
                    columns[colIdx].blocks = blocks;
                });

                const newContent = { columns: columns };
                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                
                // Ensure edit form stays visible when updating content (don't switch to preview mode)
                const isEditFormVisible = !editForm.classList.contains('hidden') && window.getComputedStyle(editForm).display !== 'none';
                if(isEditFormVisible){
                    editForm.classList.remove('hidden');
                    editForm.style.display = 'block';
                    editForm.style.visibility = 'visible';
                    editForm.style.cssText = editForm.style.cssText.replace(/display:\s*none[^;]*;?/gi, '');
                    editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                    preview.classList.add('hidden');
                    preview.style.cssText += '; display: none !important;';
                }
                
                refreshAllPreviews();
                
                // Ensure edit form stays visible after refreshAllPreviews (in case it was closed)
                if(isEditFormVisible){
                    editForm.classList.remove('hidden');
                    editForm.style.display = 'block';
                    editForm.style.visibility = 'visible';
                    editForm.style.cssText = editForm.style.cssText.replace(/display:\s*none[^;]*;?/gi, '');
                    editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                    preview.classList.add('hidden');
                    preview.style.cssText += '; display: none !important;';
                }
            } catch(e){
                console.error('Error updating column content:', e);
            }
        }

        // Wire add block buttons
        addBlockBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const colIdx = parseInt(this.getAttribute('data-column-index'));
                
                    // Open the add block modal and store column context
                    const modal = document.getElementById('add-block-modal');
                    if(modal){
                    // Get block ID - try data-block-id first (for existing blocks), then id or data-temp-id
                    const blockId = li.getAttribute('data-block-id') || '';
                    const liId = li.id || li.getAttribute('data-temp-id') || '';
                    
                    // Debug logging
                    console.log('Opening modal for column:', {
                        blockId: blockId,
                        liId: liId,
                        columnIndex: colIdx,
                        li: li
                    });
                    
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    modal.setAttribute('data-column-context', JSON.stringify({
                        blockId: blockId,
                        liId: liId,
                        columnIndex: colIdx
                    }));
                    openModal(); // Use openModal to handle visibility and button hiding
                }
            });
        });

        // Wire edit block buttons for temp blocks
        const editBlockBtns = li.querySelectorAll('.nested-block-edit-btn');
        editBlockBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const colIdx = parseInt(this.getAttribute('data-column-index'));
                const blockIdx = parseInt(this.getAttribute('data-block-index'));
                
                // Get block data
                const blocksList = editForm.querySelector(`.column-blocks-list[data-column-index="${colIdx}"]`);
                const blockItem = blocksList?.querySelector(`.nested-block-item:nth-child(${blockIdx + 1})`);
                
                if(blockItem){
                    let blockType = blockItem.getAttribute('data-block-type');
                    let blockContent = {};
                    
                    // Get from data attribute or content input
                    const blockData = blockItem.getAttribute('data-block-data');
                    if(blockData){
                        try {
                            const parsed = JSON.parse(blockData);
                            blockType = parsed.type || blockType;
                            blockContent = parsed.content || {};
                        } catch(e){}
                    }
                    
                    // Try to get from content input
                    if(Object.keys(blockContent).length === 0){
                        try {
                            const currentContent = JSON.parse(contentInput.value || '{}');
                            const columns = currentContent.columns || [];
                            if(columns[colIdx] && columns[colIdx].blocks && columns[colIdx].blocks[blockIdx]){
                                blockContent = columns[colIdx].blocks[blockIdx].content || {};
                                blockType = columns[colIdx].blocks[blockIdx].type || blockType;
                            }
                        } catch(e){}
                    }
                    
                    // Open edit modal
                    openNestedBlockEditModal(blockType, blockContent, colIdx, blockIdx, li);
                }
            });
        });
        
        // Wire remove block buttons
        removeBlockBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const colIdx = parseInt(this.getAttribute('data-column-index'));
                const blockIdx = parseInt(this.getAttribute('data-block-index'));
                
                const blocksList = editForm.querySelector(`.column-blocks-list[data-column-index="${colIdx}"]`);
                const blockItem = blocksList?.querySelector(`.nested-block-item:nth-child(${blockIdx + 1})`);
                if(blockItem){
                    blockItem.remove();
                    updateColumnContent();
                }
            });
        });

    }

    function setupHeadingEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const textInput = li.querySelector('.heading-text-input');
        const levelSelect = li.querySelector('.heading-level-select');
        const alignmentSelect = li.querySelector('.heading-alignment-select');
        const fontColorInput = li.querySelector('.heading-font-color-input');
        const fontColorText = li.querySelector('.heading-font-color-text');
        const backgroundTypeSelect = li.querySelector('.heading-background-type-select');
        const backgroundColorInput = li.querySelector('.heading-background-color-input');
        const backgroundColorText = li.querySelector('.heading-background-color-text');
        const backgroundImageInput = li.querySelector('.heading-background-image-input');
        const heightInput = li.querySelector('.heading-height-input');
        const contentInput = li.querySelector('.heading-content-input');
        const bgColorContainer = li.querySelector('.heading-background-color-container');
        const bgImageContainer = li.querySelector('.heading-background-image-container');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        function updateHeadingContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const backgroundType = backgroundTypeSelect ? backgroundTypeSelect.value : (currentContent.backgroundType || 'none');
                
                const newContent = {
                    text: textInput ? textInput.value : (currentContent.text || 'Your Heading Text'),
                    level: levelSelect ? levelSelect.value : (currentContent.level || 'h2'),
                    alignment: alignmentSelect ? alignmentSelect.value : (currentContent.alignment || 'left'),
                    fontColor: fontColorInput ? fontColorInput.value : (currentContent.fontColor || '#000000'),
                    backgroundType: backgroundType,
                    backgroundColor: (backgroundType === 'color' && backgroundColorInput) ? backgroundColorInput.value : (backgroundType === 'color' ? (currentContent.backgroundColor || '') : ''),
                    backgroundImage: (backgroundType === 'image' && backgroundImageInput) ? backgroundImageInput.value : (backgroundType === 'image' ? (currentContent.backgroundImage || '') : ''),
                    height: heightInput ? heightInput.value : (currentContent.height || 'auto')
                };

                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){}
        }

        // Wire inputs
        if(textInput){
            textInput.addEventListener('input', updateHeadingContent);
        }
        if(levelSelect){
            levelSelect.addEventListener('change', updateHeadingContent);
        }
        if(alignmentSelect){
            alignmentSelect.addEventListener('change', updateHeadingContent);
        }
        
        // Wire font color inputs
        if(fontColorInput && fontColorText){
            fontColorInput.addEventListener('input', () => {
                fontColorText.value = fontColorInput.value;
                updateHeadingContent();
            });
            fontColorText.addEventListener('input', () => {
                if(/^#[0-9A-F]{6}$/i.test(fontColorText.value)){
                    fontColorInput.value = fontColorText.value;
                    updateHeadingContent();
                }
            });
        }
        
        // Wire background type select
        if(backgroundTypeSelect){
            backgroundTypeSelect.addEventListener('change', () => {
                const bgType = backgroundTypeSelect.value;
                if(bgColorContainer){
                    bgColorContainer.style.display = bgType === 'color' ? 'block' : 'none';
                }
                if(bgImageContainer){
                    bgImageContainer.style.display = bgType === 'image' ? 'block' : 'none';
                }
                updateHeadingContent();
            });
        }
        
        // Wire background color inputs
        if(backgroundColorInput && backgroundColorText){
            backgroundColorInput.addEventListener('input', () => {
                backgroundColorText.value = backgroundColorInput.value;
                updateHeadingContent();
            });
            backgroundColorText.addEventListener('input', () => {
                if(/^#[0-9A-F]{6}$/i.test(backgroundColorText.value)){
                    backgroundColorInput.value = backgroundColorText.value;
                    updateHeadingContent();
                }
            });
        }
        
        // Wire background image input
        if(backgroundImageInput){
            backgroundImageInput.addEventListener('input', updateHeadingContent);
        }
        
        // Wire height input
        if(heightInput){
            heightInput.addEventListener('input', updateHeadingContent);
        }

    }

    function setupImageEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const srcInput = li.querySelector('.image-src-input');
        const altInput = li.querySelector('.image-alt-input');
        const captionInput = li.querySelector('.image-caption-input');
        const widthSelect = li.querySelector('.image-width-select');
        const imagePreview = li.querySelector('.image-preview');
        const contentInput = li.querySelector('.image-content-input');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        function updateImageContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const newContent = {
                    src: srcInput ? srcInput.value : (currentContent.src || ''),
                    alt: altInput ? altInput.value : (currentContent.alt || ''),
                    caption: captionInput ? captionInput.value : (currentContent.caption || ''),
                    width: widthSelect ? widthSelect.value : (currentContent.width || 'full')
                };

                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){}
        }

        // Wire inputs
        if(srcInput){
            srcInput.addEventListener('input', () => {
                // Update preview if URL changes
                if(imagePreview && srcInput.value){
                    imagePreview.src = srcInput.value;
                    imagePreview.parentElement.style.display = 'block';
                }
                updateImageContent();
            });
        }
        if(altInput){
            altInput.addEventListener('input', updateImageContent);
        }
        if(captionInput){
            captionInput.addEventListener('input', updateImageContent);
        }
        if(widthSelect){
            widthSelect.addEventListener('change', updateImageContent);
        }

    }

    function setupGalleryEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const displaySelect = li.querySelector('.gallery-display-select');
        const autoplayCheckbox = li.querySelector('.gallery-autoplay-checkbox');
        const autoplayContainer = li.querySelector('.gallery-autoplay-container');
        const imagesList = li.querySelector('.gallery-images-list');
        const addImageBtn = li.querySelector('.gallery-add-image-btn');
        const contentInput = li.querySelector('.gallery-content-input');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        // Update gallery content
        function updateGalleryContent(){
            try {
                if(!imagesList || !contentInput) return;
                
                const currentContent = JSON.parse(contentInput.value || '{}');
                const images = [];
                
                // Collect all images from the list
                const imageItems = imagesList.querySelectorAll('.gallery-image-item');
                imageItems.forEach(item => {
                    const srcInput = item.querySelector('.gallery-image-src');
                    const altInput = item.querySelector('.gallery-image-alt');
                    const src = srcInput ? srcInput.value.trim() : '';
                    const alt = altInput ? altInput.value.trim() : '';
                    if(src){
                        images.push({src, alt});
                    }
                });

                const newContent = {
                    images: images,
                    display: displaySelect?.value || 'grid',
                    autoplay: autoplayCheckbox?.checked || false
                };
                
                contentInput.value = JSON.stringify(newContent);
                if(preview){
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                }
                refreshAllPreviews();
                
                // Debug log (remove in production)
            } catch(e){
                console.error('Error updating gallery content:', e);
            }
        }

        // Display type change
        if(displaySelect){
            displaySelect.addEventListener('change', () => {
                const isSlider = displaySelect.value === 'slider';
                if(autoplayContainer){
                    autoplayContainer.style.display = isSlider ? 'block' : 'none';
                }
                updateGalleryContent();
            });
        }

        // Autoplay checkbox
        if(autoplayCheckbox){
            autoplayCheckbox.addEventListener('change', updateGalleryContent);
        }

        // Add new image item
        function addGalleryImageItem(src, alt){
            const item = document.createElement('div');
            item.className = 'flex items-center gap-2 p-2 bg-gray-50 border rounded gallery-image-item';
            item.setAttribute('data-image-index', Date.now());
            
            const previewHtml = src ? `<div class="w-16 h-16 border rounded overflow-hidden">
                <img src="${src}" alt="Preview" class="w-full h-full object-cover gallery-image-preview">
            </div>` : '';
            
            item.innerHTML = `
                <div class="flex-1 grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Image URL</label>
                        <div class="flex gap-1 items-center lfm-url-field">
                            <input type="text" value="${src}" class="flex-1 border rounded px-2 py-1 text-xs gallery-image-src" placeholder="/path/to/image.jpg">
                            <button type="button" class="js-lfm-pick-image shrink-0 text-[10px] font-semibold text-[#0075de] px-1.5 py-0.5 border border-[#0075de]/30 rounded">Lib</button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Alt Text</label>
                        <input type="text" value="${alt}" class="w-full border rounded px-2 py-1 text-xs gallery-image-alt" placeholder="Alt text">
                    </div>
                </div>
                ${previewHtml}
                <button type="button" class="text-red-600 hover:text-red-800 gallery-remove-image-btn">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            // Wire inputs
            const srcInput = item.querySelector('.gallery-image-src');
            const altInput = item.querySelector('.gallery-image-alt');
            const previewImg = item.querySelector('.gallery-image-preview');
            
            srcInput.addEventListener('input', () => {
                updateGalleryContent();
                // Update preview
                if(previewImg){
                    previewImg.src = srcInput.value;
                    if(srcInput.value && !previewImg.parentElement){
                        const previewDiv = document.createElement('div');
                        previewDiv.className = 'w-16 h-16 border rounded overflow-hidden';
                        previewDiv.appendChild(previewImg);
                        item.insertBefore(previewDiv, item.querySelector('.gallery-remove-image-btn'));
                    }
                }
            });
            
            altInput.addEventListener('input', updateGalleryContent);
            
            // Remove button
            const removeBtn = item.querySelector('.gallery-remove-image-btn');
            removeBtn.addEventListener('click', () => {
                item.remove();
                updateGalleryContent();
            });
            
            // Remove "No images yet" placeholder if it exists
            const noImagesMsg = imagesList.querySelector('.text-xs.text-gray-400');
            if(noImagesMsg && noImagesMsg.textContent.includes('No images')){
                noImagesMsg.remove();
            }
            
            imagesList.appendChild(item);
            updateGalleryContent();
        }

        // Add image button
        if(addImageBtn){
            addImageBtn.addEventListener('click', () => {
                addGalleryImageItem('', '');
            });
        }

        // Wire existing image items
        const existingImageItems = imagesList.querySelectorAll('.gallery-image-item');
        existingImageItems.forEach(item => {
            const srcInput = item.querySelector('.gallery-image-src');
            const altInput = item.querySelector('.gallery-image-alt');
            const removeBtn = item.querySelector('.gallery-remove-image-btn');
            
            if(srcInput) srcInput.addEventListener('input', updateGalleryContent);
            if(altInput) altInput.addEventListener('input', updateGalleryContent);
            if(removeBtn){
                removeBtn.addEventListener('click', () => {
                    item.remove();
                    updateGalleryContent();
                });
            }
        });

    }

    function setupMapEditor(li){
        
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const addressInput = li.querySelector('.map-address-input');
        const latInput = li.querySelector('.map-latitude-input');
        const lngInput = li.querySelector('.map-longitude-input');
        const zoomSlider = li.querySelector('.map-zoom-slider');
        const zoomDisplay = li.querySelector('.map-zoom-display');
        const contentInput = li.querySelector('input.map-content-input[type="hidden"]');

        if(!preview || !editForm || !contentInput) {
            console.warn('Map editor: Missing required elements');
            return;
        }

        // Click preview to toggle editor
        preview.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                preview.classList.add('hidden');
                preview.style.cssText += '; display: none !important;';
            } else {
                editForm.classList.add('hidden');
                editForm.style.cssText += '; display: none !important;';
                preview.classList.remove('hidden');
                preview.style.cssText += '; display: block !important;';
            }
        });

        // Update zoom display when slider changes
        if(zoomSlider && zoomDisplay) {
            zoomSlider.addEventListener('input', function(){
                zoomDisplay.textContent = this.value;
                updateMapContent();
            });
        }

        // Update content when inputs change
        if(addressInput) {
            addressInput.addEventListener('input', updateMapContent);
            addressInput.addEventListener('blur', function(){
                // Optional: Here you could add geocoding to convert address to lat/lng
                // For now, we'll just update the content
                updateMapContent();
            });
        }

        if(latInput) latInput.addEventListener('input', updateMapContent);
        if(lngInput) lngInput.addEventListener('input', updateMapContent);

        function updateMapContent(){
            if(!contentInput || !preview) return;
            
            const lat = parseFloat(latInput?.value || 34.0522);
            const lng = parseFloat(lngInput?.value || -118.2437);
            const zoom = parseInt(zoomSlider?.value || 12);
            const address = addressInput?.value || '';
            
            const newContent = {
                latitude: lat,
                longitude: lng,
                zoom: zoom,
                address: address
            };
            
            const contentJson = JSON.stringify(newContent);
            contentInput.value = contentJson;
            preview.setAttribute('data-content', contentJson);
            
            // Immediately refresh this preview to show updated content
            const previewContainer = preview.querySelector('.block-preview-content');
            if(previewContainer) {
                const type = preview.getAttribute('data-type') || 'map';
                const c = newContent;
                const lat = c.latitude || 34.0522;
                const lng = c.longitude || -118.2437;
                const zoom = c.zoom || 12;
                const address = c.address || '';
                
                previewContainer.innerHTML = `<div class="border rounded bg-gray-100 relative" style="height: 300px;">
                    <div class="absolute inset-0 flex items-center justify-center bg-gray-200 border-2 border-dashed border-gray-400">
                        <div class="text-center p-4">
                            <i class="fas fa-map-marker-alt text-3xl text-gray-500 mb-2"></i>
                            <p class="text-sm font-medium text-gray-700">${address || 'Map Location'}</p>
                            <p class="text-xs text-gray-500 mt-1">Lat: ${lat}, Lng: ${lng}</p>
                            <p class="text-xs text-gray-500">Zoom: ${zoom}</p>
                        </div>
                    </div>
                    ${address ? `<div class="absolute bottom-2 left-2 bg-white px-2 py-1 rounded text-xs shadow">${address}</div>` : ''}
                </div>`;
            }
            
            // Also refresh all previews globally
            refreshAllPreviews();
        }


        // For existing blocks, also handle form submission
        const form = editForm.closest('form');
        if(form && form.id !== 'modal-add-block-form') {
            const submitBtn = form.querySelector('button[type="submit"]');
            if(submitBtn) {
                submitBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    updateMapContent();
                    form.submit();
                });
            }
        }
    }

    function setupTestimonialEditor(li){
        
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const quoteInput = li.querySelector('.testimonial-quote-input');
        const authorInput = li.querySelector('.testimonial-author-input');
        const sourceInput = li.querySelector('.testimonial-source-input');
        const imageInput = li.querySelector('.testimonial-image-input');
        const contentInput = li.querySelector('input.testimonial-content-input[type="hidden"]');

        if(!preview || !editForm || !contentInput) {
            console.warn('Testimonial editor: Missing required elements');
            return;
        }

        // Click preview to toggle editor
        preview.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                preview.classList.add('hidden');
                preview.style.cssText += '; display: none !important;';
            } else {
                editForm.classList.add('hidden');
                editForm.style.cssText += '; display: none !important;';
                preview.classList.remove('hidden');
                preview.style.cssText += '; display: block !important;';
            }
        });

        // Update content when inputs change
        if(quoteInput) quoteInput.addEventListener('input', updateTestimonialContent);
        if(authorInput) authorInput.addEventListener('input', updateTestimonialContent);
        if(sourceInput) sourceInput.addEventListener('input', updateTestimonialContent);
        if(imageInput) imageInput.addEventListener('input', updateTestimonialContent);

        function updateTestimonialContent(){
            if(!contentInput || !preview) return;
            
            const quote = quoteInput?.value || '';
            const author = authorInput?.value || '';
            const source = sourceInput?.value || '';
            const image = imageInput?.value || '';
            
            const newContent = {
                quote: quote,
                author: author,
                source: source,
                image: image
            };
            
            const contentJson = JSON.stringify(newContent);
            contentInput.value = contentJson;
            preview.setAttribute('data-content', contentJson);
            
            // Immediately refresh this preview to show updated content
            const previewContainer = preview.querySelector('.block-preview-content');
            if(previewContainer) {
                const quote = newContent.quote || 'Great service!';
                const author = newContent.author || 'Jane Doe';
                const source = newContent.source || 'Company X';
                const image = newContent.image || '';
                
                // Helper function to resolve image URL
                function resolveImageUrl(src) {
                    if(!src || src.trim() === '') return null;
                    if(src.startsWith('data:')) return src; // Base64 data URL
                    if(src.startsWith('http://') || src.startsWith('https://')) return src; // Absolute URL
                    if(src.startsWith('/')) return src; // Relative path
                    return '/storage/' + src; // Storage path
                }
                
                const imgUrl = resolveImageUrl(image);
                
                previewContainer.innerHTML = `<div class="border rounded bg-white p-6 shadow-sm">
                    <div class="flex items-start space-x-4">
                        ${imgUrl ? `<img src="${imgUrl}" alt="${author}" class="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0" onerror="this.style.display='none'; this.nextElementSibling?.classList.remove('hidden');">
                            <div class="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-200 flex-shrink-0 hidden flex items-center justify-center"><i class="fas fa-user  text-gray-400 text-xl"></i></div>` : `<div class="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-200 flex-shrink-0 flex items-center justify-center"><i class="fas fa-user  text-gray-400 text-xl"></i></div>`}
                        <div class="flex-1">
                            <div class="mb-3">
                                <svg class="w-8 h-8 text-blue-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-3.312.817-5.546 3.133-5.546 6.688 0 3.41 2.364 5.985 5.546 6.688v7.391h-10zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-3.312.817-5.546 3.133-5.546 6.688 0 3.41 2.361 5.985 5.546 6.688v7.391h-10z"/>
                                </svg>
                                <p class="text-gray-700 italic text-base leading-relaxed">"${quote}"</p>
                            </div>
                            <div class="border-t pt-3">
                                <p class="font-semibold text-gray-900">${author}</p>
                                ${source ? `<p class="text-sm text-gray-600">${source}</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
            }
            
            // Also refresh all previews globally
            refreshAllPreviews();
        }


        // For existing blocks, also handle form submission
        const form = editForm.closest('form');
        if(form && form.id !== 'modal-add-block-form') {
            const submitBtn = form.querySelector('button[type="submit"]');
            if(submitBtn) {
                submitBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    updateTestimonialContent();
                    form.submit();
                });
            }
        }
    }

    function setupCodeEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const codeTextarea = li.querySelector('textarea.code-content-input');
        const contentInput = li.querySelector('input.code-content-input[type="hidden"]');

        if(!editForm || !codeTextarea || !contentInput) {
            console.warn('Code editor: Missing required elements');
            return;
        }

        // Click preview to toggle editor
        preview.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('CODE BLOCK CLICKED!');
            const isHidden = editForm.classList.contains('hidden');
            console.log('Form is hidden before toggle:', isHidden);
            console.log('EditForm element:', editForm);
            console.log('EditForm computed display:', window.getComputedStyle(editForm).display);
            
            if(isHidden){
                // Remove hidden class and force display - use assignment, not +=
                editForm.classList.remove('hidden');
                editForm.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';
                if(codeTextarea) {
                    codeTextarea.style.cssText = 'display: block !important; visibility: visible !important;';
                }
                preview.classList.add('hidden');
                preview.style.cssText = 'display: none !important;';
                
                console.log('Editor opened - Form classes:', editForm.className);
                console.log('Editor opened - Form style.cssText:', editForm.style.cssText);
                console.log('Editor opened - Form computed display:', window.getComputedStyle(editForm).display);
                console.log('Textarea element:', codeTextarea);
                console.log('Textarea computed display:', codeTextarea ? window.getComputedStyle(codeTextarea).display : 'not found');
                
                setTimeout(() => {
                    if(codeTextarea) {
                        codeTextarea.focus();
                        codeTextarea.scrollIntoView({behavior: 'smooth', block: 'nearest'});
                        console.log('Textarea focused');
                    } else {
                        console.error('Textarea not found after opening editor!');
                    }
                }, 100);
            } else {
                editForm.classList.add('hidden');
                editForm.style.cssText = 'display: none !important;';
                preview.classList.remove('hidden');
                preview.style.cssText = 'display: block !important;';
            }
        });
    }

    function setupHeroSectionEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const contentInput = li.querySelector('.hero-content-input');
        
        if(!preview || !editForm || !contentInput) {
            // Try alternative selectors
            if(!editForm) {
                const mt3Div = li.querySelector('.mt-3');
                if(mt3Div) {
                    editForm = mt3Div.querySelector('.block-edit-form');
                }
            }
            if(!editForm) {
                editForm = li.querySelector('form.block-edit-form');
            }
            if(!contentInput && editForm) {
                contentInput = editForm.querySelector('.hero-content-input');
            }
            
            if(!preview || !editForm || !contentInput) {
                console.warn('Hero section editor: Missing required elements', {
                    hasPreview: !!preview,
                    hasEditForm: !!editForm,
                    hasContentInput: !!contentInput,
                    liChildren: li ? Array.from(li.children).map(c => c.tagName + (c.className ? '.' + c.className.split(' ').join('.') : '')) : []
                });
                return;
            }
        }

        // Wire editor controls
        const headingInput = li.querySelector('.hero-heading-input');
        const subheadingInput = li.querySelector('.hero-subheading-input');
        const backgroundTypeSelect = li.querySelector('.hero-background-type-select');
        const backgroundImageUrlInput = li.querySelector('.hero-background-image-url-input');
        const backgroundVideoUrlInput = li.querySelector('.hero-background-video-url-input');
        const backgroundColorInput = li.querySelector('.hero-background-color-input');
        const backgroundColorText = li.querySelector('.hero-background-color-text');
        const overlayColorInput = li.querySelector('.hero-overlay-color-input');
        const overlayColorText = li.querySelector('.hero-overlay-color-text');
        const overlayOpacityInput = li.querySelector('.hero-overlay-opacity-input');
        const buttonTextInput = li.querySelector('.hero-button-text-input');
        const buttonUrlInput = li.querySelector('.hero-button-url-input');
        const buttonStyleInput = li.querySelector('.hero-button-style-input');
        const buttonTargetSelect = li.querySelector('.hero-button-target-select');
        const alignmentSelect = li.querySelector('.hero-alignment-select');
        const heightSelect = li.querySelector('.hero-height-select');
        const textColorInput = li.querySelector('.hero-text-color-input');
        const textColorText = li.querySelector('.hero-text-color-text');
        
        const bgImageContainer = li.querySelector('.hero-background-image-container');
        const bgVideoContainer = li.querySelector('.hero-background-video-container');
        const bgColorContainer = li.querySelector('.hero-background-color-container');
        function updateHeroContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const backgroundType = backgroundTypeSelect ? backgroundTypeSelect.value : (currentContent.background_type || 'color');
                
                const newContent = {
                    heading: headingInput ? headingInput.value : (currentContent.heading || 'Welcome'),
                    subheading: subheadingInput ? subheadingInput.value : (currentContent.subheading || ''),
                    background_type: backgroundType,
                    background_image_url: (backgroundType === 'image' && backgroundImageUrlInput) ? backgroundImageUrlInput.value : (backgroundType === 'image' ? (currentContent.background_image_url || '') : ''),
                    background_video_url: (backgroundType === 'video' && backgroundVideoUrlInput) ? backgroundVideoUrlInput.value : (backgroundType === 'video' ? (currentContent.background_video_url || '') : ''),
                    background_color: (backgroundType === 'color' && backgroundColorInput) ? backgroundColorInput.value : (backgroundType === 'color' ? (currentContent.background_color || '#000000') : ''),
                    overlay_color: overlayColorInput ? overlayColorInput.value : (currentContent.overlay_color || '#000000'),
                    overlay_opacity: overlayOpacityInput ? parseFloat(overlayOpacityInput.value) : (currentContent.overlay_opacity ?? 0.5),
                    button_text: buttonTextInput ? buttonTextInput.value : (currentContent.button_text || ''),
                    button_url: buttonUrlInput ? buttonUrlInput.value : (currentContent.button_url || ''),
                    button_style: buttonStyleInput ? buttonStyleInput.value : (currentContent.button_style || ''),
                    button_target: buttonTargetSelect ? buttonTargetSelect.value : (currentContent.button_target || '_self'),
                    alignment: alignmentSelect ? alignmentSelect.value : (currentContent.alignment || 'center'),
                    height: heightSelect ? heightSelect.value : (currentContent.height || 'medium'),
                    text_color: textColorInput ? textColorInput.value : (currentContent.text_color || '#ffffff')
                };

                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){
                console.error('Error updating hero content:', e);
            }
        }

        // Wire inputs
        if(headingInput) headingInput.addEventListener('input', updateHeroContent);
        if(subheadingInput) subheadingInput.addEventListener('input', updateHeroContent);
        if(buttonTextInput) buttonTextInput.addEventListener('input', updateHeroContent);
        if(buttonUrlInput) buttonUrlInput.addEventListener('input', updateHeroContent);
        if(buttonStyleInput) buttonStyleInput.addEventListener('input', updateHeroContent);
        if(backgroundImageUrlInput) backgroundImageUrlInput.addEventListener('input', updateHeroContent);
        if(backgroundVideoUrlInput) backgroundVideoUrlInput.addEventListener('input', updateHeroContent);
        if(overlayOpacityInput) overlayOpacityInput.addEventListener('input', updateHeroContent);
        
        // Wire selects
        if(backgroundTypeSelect){
            backgroundTypeSelect.addEventListener('change', () => {
                const bgType = backgroundTypeSelect.value;
                if(bgImageContainer) bgImageContainer.style.display = bgType === 'image' ? 'block' : 'none';
                if(bgVideoContainer) bgVideoContainer.style.display = bgType === 'video' ? 'block' : 'none';
                if(bgColorContainer) bgColorContainer.style.display = bgType === 'color' ? 'block' : 'none';
                updateHeroContent();
            });
        }
        if(buttonTargetSelect) buttonTargetSelect.addEventListener('change', updateHeroContent);
        if(alignmentSelect) alignmentSelect.addEventListener('change', updateHeroContent);
        if(heightSelect) heightSelect.addEventListener('change', updateHeroContent);
        
        // Wire color pickers
        if(backgroundColorInput && backgroundColorText){
            backgroundColorInput.addEventListener('input', () => {
                backgroundColorText.value = backgroundColorInput.value;
                updateHeroContent();
            });
            backgroundColorText.addEventListener('input', () => {
                if(/^#[0-9A-F]{6}$/i.test(backgroundColorText.value)){
                    backgroundColorInput.value = backgroundColorText.value;
                    updateHeroContent();
                }
            });
        }
        
        if(overlayColorInput && overlayColorText){
            overlayColorInput.addEventListener('input', () => {
                overlayColorText.value = overlayColorInput.value;
                updateHeroContent();
            });
            overlayColorText.addEventListener('input', () => {
                if(/^#[0-9A-F]{6}$/i.test(overlayColorText.value)){
                    overlayColorInput.value = overlayColorText.value;
                    updateHeroContent();
                }
            });
        }
        
        if(textColorInput && textColorText){
            textColorInput.addEventListener('input', () => {
                textColorText.value = textColorInput.value;
                updateHeroContent();
            });
            textColorText.addEventListener('input', () => {
                if(/^#[0-9A-F]{6}$/i.test(textColorText.value)){
                    textColorInput.value = textColorText.value;
                    updateHeroContent();
                }
            });
        }
        
        // Update content before form submission
        editForm.addEventListener('submit', (e) => {
            updateHeroContent();
            const hiddenContentInput = editForm.querySelector('input[name="content"]');
            if(hiddenContentInput && contentInput){
                hiddenContentInput.value = contentInput.value;
            }
        });
    }

    // Wire up form submissions for existing blocks

    function setupRichTextEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const styleSelect = li.querySelector('.richtext-style-select');
        const editor = li.querySelector('.richtext-editor');
        const contentInput = li.querySelector('.richtext-content-input');
        const toolbarBtns = li.querySelectorAll('.richtext-toolbar-btn');
        const backgroundTypeSelect = li.querySelector('.richtext-background-type-select');
        const backgroundColorInput = li.querySelector('.richtext-background-color-input');
        const backgroundColorText = li.querySelector('.richtext-background-color-text');
        const backgroundImageInput = li.querySelector('.richtext-background-image-input');
        const heightInput = li.querySelector('.richtext-height-input');
        const paddingInput = li.querySelector('.richtext-padding-input');
        const imagePreview = li.querySelector('.richtext-image-preview');

        if(!preview || !editForm || !editor) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
                editor.focus();
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        // Handle placeholder
        editor.addEventListener('focus', function() {
            if(this.textContent.trim() === (this.dataset.placeholder || 'Write something...')){
                this.textContent = '';
            }
        });

        editor.addEventListener('blur', function() {
            if(this.textContent.trim() === ''){
                this.textContent = this.dataset.placeholder || 'Write something...';
            }
        });

        function updateRichTextContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const htmlContent = editor.innerHTML || '<p></p>';
                const backgroundType = backgroundTypeSelect ? backgroundTypeSelect.value : (currentContent.backgroundType || 'none');
                
                const newContent = {
                    html: htmlContent,
                    style: styleSelect ? styleSelect.value : (currentContent.style || 'normal'),
                    backgroundType: backgroundType,
                    backgroundColor: backgroundType === 'color' ? (backgroundColorInput ? backgroundColorInput.value : '') : '',
                    backgroundImage: backgroundType === 'image' ? (backgroundImageInput ? backgroundImageInput.value : '') : '',
                    height: heightInput ? heightInput.value : (currentContent.height || 'auto'),
                    padding: paddingInput ? paddingInput.value : (currentContent.padding || '')
                };

                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){}
        }

        // Background type toggle
        if(backgroundTypeSelect){
            const colorContainer = li.querySelector('.richtext-background-color-container');
            const imageContainer = li.querySelector('.richtext-background-image-container');
            
            backgroundTypeSelect.addEventListener('change', function() {
                const bgType = this.value;
                if(colorContainer) colorContainer.style.display = bgType === 'color' ? 'block' : 'none';
                if(imageContainer) imageContainer.style.display = bgType === 'image' ? 'block' : 'none';
                updateRichTextContent();
            });
        }

        // Background color sync
        if(backgroundColorInput && backgroundColorText){
            backgroundColorInput.addEventListener('input', function() {
                if(backgroundColorText) backgroundColorText.value = this.value;
                updateRichTextContent();
            });
            backgroundColorText.addEventListener('input', function() {
                if(backgroundColorInput && /^#[0-9A-F]{6}$/i.test(this.value)){
                    backgroundColorInput.value = this.value;
                }
                updateRichTextContent();
            });
        }

        // Height and padding inputs
        if(heightInput) heightInput.addEventListener('input', updateRichTextContent);
        if(paddingInput) paddingInput.addEventListener('input', updateRichTextContent);

        // Wire toolbar buttons
        toolbarBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const command = this.dataset.command;
                const arg = this.dataset.arg;
                
                editor.focus();
                
                if(command === 'formatBlock' && arg){
                    // Ensure we have a selection for formatBlock
                    const selection = window.getSelection();
                    if(selection.rangeCount === 0){
                        const range = document.createRange();
                        range.selectNodeContents(editor);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                    document.execCommand('formatBlock', false, arg);
                } else if(this.classList.contains('richtext-link-btn')){
                    const selection = window.getSelection();
                    const selectedText = selection.toString();
                    const url = prompt(selectedText ? `Enter URL for "${selectedText}":` : 'Enter URL:');
                    if(url){
                        if(selectedText){
                            document.execCommand('createLink', false, url);
                        } else {
                            const linkText = prompt('Enter link text:', 'Link');
                            if(linkText){
                                document.execCommand('insertHTML', false, `<a href="${url}">${linkText}</a>`);
                            }
                        }
                    }
                } else if(this.classList.contains('richtext-table-btn')){
                    const rows = prompt('Enter number of rows:', '3');
                    const cols = prompt('Enter number of columns:', '3');
                    if(rows && cols && !isNaN(rows) && !isNaN(cols)){
                        const r = parseInt(rows);
                        const c = parseInt(cols);
                        let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;"><tbody>';
                        for(let i = 0; i < r; i++){
                            tableHTML += '<tr>';
                            for(let j = 0; j < c; j++){
                                tableHTML += `<td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>`;
                            }
                            tableHTML += '</tr>';
                        }
                        tableHTML += '</tbody></table>';
                        document.execCommand('insertHTML', false, tableHTML);
                    }
                } else {
                    // For list commands, ensure proper selection
                    if(command === 'insertUnorderedList' || command === 'insertOrderedList'){
                        // Ensure editor has focus first
                        editor.focus();
                        
                        // Use setTimeout to ensure focus is established
                        setTimeout(() => {
                            const selection = window.getSelection();
                            let range;
                            let blockElement = null;
                            
                            // Get current selection range if it exists
                            if(selection.rangeCount > 0){
                                range = selection.getRangeAt(0);
                                // Find the current block element from the range
                                let node = range.commonAncestorContainer;
                                if(node.nodeType === Node.TEXT_NODE){
                                    node = node.parentNode;
                                }
                                // Walk up to find a block element
                                while(node && node !== editor && node.nodeType !== Node.DOCUMENT_NODE){
                                    if(node.nodeType === Node.ELEMENT_NODE){
                                        const tagName = node.tagName;
                                        if(tagName === 'P' || tagName === 'DIV' || tagName === 'LI' || 
                                           tagName === 'H1' || tagName === 'H2' || tagName === 'H3' || 
                                           tagName === 'H4' || tagName === 'H5' || tagName === 'H6'){
                                            blockElement = node;
                                            break;
                                        }
                                    }
                                    node = node.parentNode;
                                }
                            }
                            
                            // If no block element found, create one
                            if(!blockElement || blockElement === editor){
                                blockElement = document.createElement('p');
                                
                                if(selection.rangeCount > 0){
                                    try {
                                        const currentRange = selection.getRangeAt(0);
                                        // Insert at cursor position
                                        if(currentRange.startContainer.nodeType === Node.TEXT_NODE){
                                            const textNode = currentRange.startContainer;
                                            const parent = textNode.parentNode;
                                            const offset = currentRange.startOffset;
                                            
                                            if(offset === 0){
                                                parent.insertBefore(blockElement, textNode);
                                            } else if(offset === textNode.length){
                                                parent.insertBefore(blockElement, textNode.nextSibling);
                                            } else {
                                                // Split text node and insert in between
                                                const newNode = textNode.splitText(offset);
                                                parent.insertBefore(blockElement, newNode);
                                            }
                                        } else {
                                            currentRange.insertNode(blockElement);
                                        }
                                        range = document.createRange();
                                        range.selectNodeContents(blockElement);
                                        range.collapse(false);
                                    } catch(e) {
                                        editor.appendChild(blockElement);
                                        range = document.createRange();
                                        range.selectNodeContents(blockElement);
                                        range.collapse(false);
                                    }
                                } else {
                                    // If editor is empty or has no content, add paragraph
                                    if(editor.innerHTML.trim() === '' || editor.textContent.trim() === ''){
                                        editor.innerHTML = '<p></p>';
                                        blockElement = editor.querySelector('p');
                                    } else {
                                        editor.appendChild(blockElement);
                                    }
                                    if(!blockElement) blockElement = editor.querySelector('p') || document.createElement('p');
                                    range = document.createRange();
                                    range.selectNodeContents(blockElement);
                                    range.collapse(false);
                                }
                            } else {
                                // Select the found block element
                                range = document.createRange();
                                range.selectNodeContents(blockElement);
                            }
                            
                            // Set selection
                            selection.removeAllRanges();
                            selection.addRange(range);
                            
                            // Execute command
                            const success = document.execCommand(command, false, null);
                            
                            // If execCommand failed, manually create list
                            if(!success){
                                const listTag = command === 'insertUnorderedList' ? 'ul' : 'ol';
                                const listHtml = `<${listTag}><li>${blockElement.innerHTML || 'List item'}</li></${listTag}>`;
                                blockElement.outerHTML = listHtml;
                            }
                            
                            // Trigger content update
                            if(typeof updateRichTextContent === 'function'){
                                updateRichTextContent();
                            } else {
                                // Fallback: trigger input event
                                editor.dispatchEvent(new Event('input'));
                            }
                        }, 10);
                        
                        // Don't execute command here, it's done in setTimeout
                        return;
                    }
                    document.execCommand(command, false, null);
                }
                
                updateRichTextContent();
            });
        });

        // Wire editor content changes
        editor.addEventListener('input', updateRichTextContent);
        editor.addEventListener('paste', function(e) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
            updateRichTextContent();
        });

        // Wire style select
        if(styleSelect){
            styleSelect.addEventListener('change', updateRichTextContent);
        }

    }

    function setupSpacerEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const sizeSelect = li.querySelector('.spacer-size-select');
        const heightSlider = li.querySelector('.spacer-height-slider');
        const heightText = li.querySelector('.spacer-height-text');
        const heightDisplay = li.querySelector('.spacer-height-display');
        const contentInput = li.querySelector('.spacer-content-input');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        const sizeMap = {small: '20px', medium: '40px', large: '60px', xlarge: '80px'};

        function updateSpacerContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                let height = currentContent.height || '40px';
                
                // If size is selected, use that
                if(sizeSelect && sizeSelect.value){
                    height = sizeMap[sizeSelect.value] || height;
                } else if(heightSlider){
                    height = heightSlider.value + 'px';
                }
                
                // Update text input and display
                if(heightText) heightText.value = height;
                if(heightDisplay) heightDisplay.textContent = height;
                if(heightSlider) heightSlider.value = parseInt(height.replace('px', '')) || 40;

                const newContent = {
                    height: height
                };
                
                // If size was selected, also include it
                if(sizeSelect && sizeSelect.value){
                    newContent.size = sizeSelect.value;
                }

                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){}
        }

        // Wire size dropdown
        if(sizeSelect){
            sizeSelect.addEventListener('change', () => {
                if(sizeSelect.value){
                    const sizeHeight = sizeMap[sizeSelect.value];
                    if(heightSlider) heightSlider.value = parseInt(sizeHeight.replace('px', ''));
                    if(heightText) heightText.value = sizeHeight;
                }
                updateSpacerContent();
            });
        }

        // Wire height slider
        if(heightSlider){
            heightSlider.addEventListener('input', () => {
                const height = heightSlider.value + 'px';
                if(heightText) heightText.value = height;
                if(heightDisplay) heightDisplay.textContent = height;
                if(sizeSelect) sizeSelect.value = ''; // Clear size selection when using slider
                updateSpacerContent();
            });
        }

        // Wire height text input
        if(heightText){
            heightText.addEventListener('input', () => {
                const value = heightText.value.trim();
                if(/^\d+px$/.test(value)){
                    const numValue = parseInt(value.replace('px', ''));
                    if(numValue >= 10 && numValue <= 200){
                        if(heightSlider) heightSlider.value = numValue;
                        if(heightDisplay) heightDisplay.textContent = value;
                        if(sizeSelect) sizeSelect.value = ''; // Clear size selection when using custom
                        updateSpacerContent();
                    }
                }
            });
        }

    }

    function setupButtonEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const textInput = li.querySelector('.button-text-input');
        const urlInput = li.querySelector('.button-url-input');
        const targetSelect = li.querySelector('.button-target-select');
        const styleSelect = li.querySelector('.button-style-select');
        const positionSelect = li.querySelector('.button-position-select');
        const contentInput = li.querySelector('.button-content-input');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        function updateButtonContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const newContent = {
                    text: textInput ? textInput.value : (currentContent.text || 'Click Me'),
                    url: urlInput ? urlInput.value : (currentContent.url || '/contact'),
                    target: targetSelect ? targetSelect.value : (currentContent.target || '_self'),
                    style: styleSelect ? styleSelect.value : (currentContent.style || 'primary'),
                    position: positionSelect ? positionSelect.value : (currentContent.position || 'left')
                };

                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){}
        }

        // Wire all inputs
        if(textInput){
            textInput.addEventListener('input', updateButtonContent);
        }
        if(urlInput){
            urlInput.addEventListener('input', updateButtonContent);
        }
        if(targetSelect){
            targetSelect.addEventListener('change', updateButtonContent);
        }
        if(styleSelect){
            styleSelect.addEventListener('change', updateButtonContent);
        }
        if(positionSelect){
            positionSelect.addEventListener('change', updateButtonContent);
        }

    }

    function setupVideoEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const typeSelect = li.querySelector('.video-type-select');
        const urlInput = li.querySelector('.video-url-input');
        const srcInput = li.querySelector('.video-src-input');
        const urlField = li.querySelector('.video-url-field');
        const srcField = li.querySelector('.video-src-field');
        const autoplayCheckbox = li.querySelector('.video-autoplay-checkbox');
        const loopCheckbox = li.querySelector('.video-loop-checkbox');
        const muteCheckbox = li.querySelector('.video-mute-checkbox');
        const contentInput = li.querySelector('.video-content-input');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        // Helper function to extract video ID from URL
        function extractVideoId(url, type){
            if(!url) return '';
            try {
                if(type === 'youtube'){
                    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
                    return match ? match[1] : '';
                } else if(type === 'vimeo'){
                    const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
                    return match ? match[1] : '';
                }
            } catch(e){}
            return '';
        }

        // Toggle fields based on video type
        function toggleFields(type){
            if(type === 'self_hosted'){
                if(urlField) urlField.style.display = 'none';
                if(srcField) srcField.style.display = 'block';
            } else {
                if(urlField) urlField.style.display = 'block';
                if(srcField) srcField.style.display = 'none';
            }
        }

        function updateVideoContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const videoType = typeSelect ? typeSelect.value : (currentContent.type || 'youtube');
                const newContent = {
                    type: videoType,
                    autoplay: autoplayCheckbox ? autoplayCheckbox.checked : (currentContent.autoplay || false),
                    loop: loopCheckbox ? loopCheckbox.checked : (currentContent.loop || false),
                    mute: muteCheckbox ? muteCheckbox.checked : (currentContent.mute || false)
                };

                if(videoType === 'self_hosted'){
                    newContent.src = srcInput ? srcInput.value : (currentContent.src || '');
                } else {
                    const url = urlInput ? urlInput.value : '';
                    const id = extractVideoId(url, videoType);
                    newContent.id = id;
                }

                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){}
        }

        // Wire type select to toggle fields
        if(typeSelect){
            typeSelect.addEventListener('change', () => {
                toggleFields(typeSelect.value);
                updateVideoContent();
            });
        }

        // Wire URL input
        if(urlInput){
            urlInput.addEventListener('input', updateVideoContent);
        }

        // Wire src input
        if(srcInput){
            srcInput.addEventListener('input', updateVideoContent);
        }

        // Wire checkboxes
        if(autoplayCheckbox){
            autoplayCheckbox.addEventListener('change', updateVideoContent);
        }
        if(loopCheckbox){
            loopCheckbox.addEventListener('change', updateVideoContent);
        }
        if(muteCheckbox){
            muteCheckbox.addEventListener('change', updateVideoContent);
        }

        // Initialize fields visibility
        if(typeSelect){
            toggleFields(typeSelect.value);
        }

    }

    function setupDividerEditor(li){
        const preview = li.querySelector('.block-preview');
        const editForm = li.querySelector('.block-edit-form');
        const styleSelect = li.querySelector('.divider-style-select');
        const colorInput = li.querySelector('.divider-color-input');
        const colorText = li.querySelector('.divider-color-text');
        const widthSelect = li.querySelector('.divider-width-select');
        const contentInput = li.querySelector('.divider-content-input');

        if(!preview || !editForm) return;

        // Click preview to toggle editor
        preview.addEventListener('click', () => {
            const isHidden = editForm.classList.contains('hidden');
            if(isHidden){
                editForm.classList.remove('hidden');
                preview.classList.add('hidden');
            } else {
                editForm.classList.add('hidden');
                preview.classList.remove('hidden');
            }
        });

        function updateDividerContent(){
            try {
                const currentContent = JSON.parse(contentInput.value || '{}');
                const newContent = {
                    style: styleSelect ? styleSelect.value : (currentContent.style || 'solid'),
                    color: colorInput ? colorInput.value : (currentContent.color || '#ccc'),
                    width: widthSelect ? widthSelect.value : (currentContent.width || 'full')
                };
                contentInput.value = JSON.stringify(newContent);
                preview.setAttribute('data-content', JSON.stringify(newContent));
                refreshAllPreviews();
            } catch(e){}
        }

        // Wire editor controls
        if(styleSelect){
            styleSelect.addEventListener('change', updateDividerContent);
        }
        if(colorInput && colorText){
            colorInput.addEventListener('input', () => {
                colorText.value = colorInput.value;
                updateDividerContent();
            });
            colorText.addEventListener('input', () => {
                if(/^#[0-9A-F]{6}$/i.test(colorText.value)){
                    colorInput.value = colorText.value;
                    updateDividerContent();
                }
            });
        }
        if(widthSelect){
            widthSelect.addEventListener('change', updateDividerContent);
        }

    }

    document.querySelectorAll('.add-block-type').forEach(choice => {
        choice.addEventListener('click', function(){
            const type = this.getAttribute('data-type');
            const content = this.getAttribute('data-content') || '{}';
            const modal = document.getElementById('add-block-modal');
            const columnContextStr = modal?.getAttribute('data-column-context');
            
            // Save state before adding block (only for main blocks, not nested)
            if(!columnContextStr) {
                HistoryManager.saveState();
            }
            
            if(columnContextStr){
                // Adding block to a column
                try {
                    const columnContext = JSON.parse(columnContextStr);
                    console.log('Adding block to column with context:', columnContext);
                    
                    // Find target block by ID (existing or temp)
                    let targetLi = null;
                    // Try to find target block by ID (existing or temp)
                    if(columnContext.blockId){
                        targetLi = document.querySelector(`li[data-block-id="${columnContext.blockId}"]`);
                        console.log('Found by blockId:', targetLi);
                    }
                    if(!targetLi && columnContext.liId){
                        targetLi = document.querySelector(`li[id="${columnContext.liId}"], li[data-temp-id="${columnContext.liId}"]`);
                        console.log('Found by liId:', targetLi, 'liId was:', columnContext.liId);
                    }
                    
                    if(targetLi){
                        // Make sure edit form is visible when adding blocks
                        const editForm = targetLi.querySelector('.block-edit-form');
                        const preview = targetLi.querySelector('.block-preview');
                        
                        // If edit form is hidden, show it temporarily
                        const wasHidden = editForm?.classList.contains('hidden');
                        if(editForm && wasHidden){
                            editForm.classList.remove('hidden');
                            if(preview) preview.classList.add('hidden');
                        }
                        
                        const blocksList = editForm?.querySelector(`.column-blocks-list[data-column-index="${columnContext.columnIndex}"]`);
                        if(!blocksList){
                            console.error('Could not find blocksList. editForm:', editForm, 'columnIndex:', columnContext.columnIndex);
                        }
                        if(blocksList){
                            // Create a new block item in the column
                            const blockItem = document.createElement('div');
                            blockItem.className = 'p-2 bg-gray-50 border rounded text-xs nested-block-item';
                            blockItem.setAttribute('data-block-data', JSON.stringify({type: type, content: JSON.parse(content)}));
                            const blockIndex = Array.from(blocksList.querySelectorAll('.nested-block-item')).length;
                            blockItem.innerHTML = `
                                <div class="flex items-center justify-between">
                                    <span class="font-medium cursor-pointer hover:text-blue-600 nested-block-title">${type.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase())}</span>
                                    <div class="flex items-center gap-2">
                                        <button type="button" class="text-blue-600 hover:text-blue-800 nested-block-edit-btn" data-column-index="${columnContext.columnIndex}" data-block-index="${blockIndex}">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button type="button" class="text-red-600 hover:text-red-800 nested-block-remove-btn" data-column-index="${columnContext.columnIndex}" data-block-index="${blockIndex}">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            `;
                            
                            // Remove "No blocks yet" message if exists
                            const emptyMsg = blocksList.querySelector('.text-xs.text-gray-400');
                            if(emptyMsg) emptyMsg.remove();
                            
                            blocksList.appendChild(blockItem);
                            
                            // Wire up the edit button for the newly added block
                            const editBtn = blockItem.querySelector('.nested-block-edit-btn');
                            if(editBtn){
                                editBtn.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const colIdx = parseInt(this.getAttribute('data-column-index'));
                                    const blockIdx = parseInt(this.getAttribute('data-block-index'));
                                    
                                    console.log('Edit button clicked (dynamically added):', {colIdx, blockIdx});
                                    
                                    // Get block data
                                    const blockData = blockItem.getAttribute('data-block-data');
                                    let blockType = blockItem.getAttribute('data-block-type');
                                    let blockContent = {};
                                    
                                    if(blockData){
                                        try {
                                            const parsed = JSON.parse(blockData);
                                            blockType = parsed.type || blockType;
                                            blockContent = parsed.content || {};
                                        } catch(e){
                                            console.error('Error parsing block data:', e);
                                        }
                                    }
                                    
                                    // Try to get from content input
                                    const contentInput = targetLi.querySelector('.column-content-input');
                                    if(contentInput && (Object.keys(blockContent).length === 0 || !blockType || blockType === 'unknown')){
                                        try {
                                            const currentContent = JSON.parse(contentInput.value || '{}');
                                            const columns = currentContent.columns || [];
                                            if(columns[colIdx] && columns[colIdx].blocks && columns[colIdx].blocks[blockIdx]){
                                                blockContent = columns[colIdx].blocks[blockIdx].content || {};
                                                blockType = columns[colIdx].blocks[blockIdx].type || blockType;
                                            }
                                        } catch(e){
                                            console.error('Error getting block data:', e);
                                        }
                                    }
                                    
                                    console.log('Opening edit modal:', {blockType, blockContent, colIdx, blockIdx});
                                    
                                    // Open edit modal
                                    if(openNestedBlockEditModal){
                                        openNestedBlockEditModal(blockType, blockContent, colIdx, blockIdx, targetLi);
                                    } else {
                                        console.error('openNestedBlockEditModal function not found!');
                                    }
                                });
                            }
                            
                            // Wire up the remove button for the newly added block
                            const removeBtn = blockItem.querySelector('.nested-block-remove-btn');
                            if(removeBtn){
                                removeBtn.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const colIdx = parseInt(this.getAttribute('data-column-index'));
                                    const blockIdx = parseInt(this.getAttribute('data-block-index'));
                                    
                                    // Update content
                                    const contentInput = targetLi.querySelector('.column-content-input');
                                    if(contentInput){
                                        try {
                                            const currentContent = JSON.parse(contentInput.value || '{}');
                                            const columns = currentContent.columns || [];
                                            if(columns[colIdx] && columns[colIdx].blocks){
                                                columns[colIdx].blocks.splice(blockIdx, 1);
                                                contentInput.value = JSON.stringify({columns: columns});
                                                const preview = targetLi.querySelector('.block-preview');
                                                if(preview) preview.setAttribute('data-content', contentInput.value);
                                                refreshAllPreviews();
                                            }
                                        } catch(e){
                                            console.error('Error removing block from column:', e);
                                        }
                                    }
                                    
                                    // Remove from DOM
                                    blockItem.remove();
                                    
                                    // Show empty message if no blocks
                                    if(blocksList && blocksList.children.length === 0){
                                        blocksList.innerHTML = '<div class="text-xs text-gray-400 text-center py-4">No blocks yet</div>';
                                    }
                                });
                            }
                            
                            // Update column content
                            const contentInput = targetLi.querySelector('.column-content-input');
                            if(contentInput){
                                try {
                                    const currentContent = JSON.parse(contentInput.value || '{}');
                                    const columns = currentContent.columns || [];
                                    if(!columns[columnContext.columnIndex]) columns[columnContext.columnIndex] = {blocks: []};
                                    if(!columns[columnContext.columnIndex].blocks) columns[columnContext.columnIndex].blocks = [];
                                    columns[columnContext.columnIndex].blocks.push({type: type, content: JSON.parse(content)});
                                    contentInput.value = JSON.stringify({columns: columns});
                                    const preview = targetLi.querySelector('.block-preview');
                                    if(preview) preview.setAttribute('data-content', contentInput.value);
                                    
                                    // Ensure edit form stays visible and preview stays hidden after adding block
                                    const editForm = targetLi.querySelector('.block-edit-form');
                                    if(editForm){
                                        editForm.classList.remove('hidden');
                                        editForm.style.display = 'block';
                                        editForm.style.visibility = 'visible';
                                        editForm.style.cssText = editForm.style.cssText.replace(/display:\s*none[^;]*;?/gi, '');
                                        editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                                    }
                                    if(preview){
                                        preview.classList.add('hidden');
                                        preview.style.cssText += '; display: none !important;';
                                    }
                                    
                                    refreshAllPreviews();
                                    
                                    // Ensure edit form stays visible after refreshAllPreviews (in case it was closed)
                                    if(editForm){
                                        editForm.classList.remove('hidden');
                                        editForm.style.display = 'block';
                                        editForm.style.visibility = 'visible';
                                        editForm.style.cssText = editForm.style.cssText.replace(/display:\s*none[^;]*;?/gi, '');
                                        editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                                    }
                                    if(preview){
                                        preview.classList.add('hidden');
                                        preview.style.cssText += '; display: none !important;';
                                    }
                                } catch(e){
                                    console.error('Error updating column content:', e);
                                }
                            }
                        } else {
                            console.error('Could not find blocksList for column index:', columnContext.columnIndex);
                        }
                    } else {
                        console.error('Could not find targetLi for column context:', columnContext);
                    }
                    // Clear column context
                    if(modal) modal.removeAttribute('data-column-context');
                } catch(e){
                    console.error('Error adding block to column:', e);
                }
            } else {
                // Normal block addition
            const width = pendingAreaWidth;
            const li = createTempBlockElement(type, content, width);
            if(list){ 
                // If there's a target block, insert after it; otherwise append to end
                if(targetBlockElement && targetBlockElement.parentNode === list) {
                    // Insert after the target block
                    const nextSibling = targetBlockElement.nextSibling;
                    if(nextSibling) {
                        list.insertBefore(li, nextSibling);
                    } else {
                        list.appendChild(li);
                    }
                } else {
                    // No target block or target block not in list, append to end
                    list.appendChild(li);
                }
                // Clear target block after use
                targetBlockElement = null;
                attachDnD(); 
                refreshAllPreviews(); 
                updateOrders(false); 
                updateEmptyMessage();
                // Save state after adding block
                HistoryManager.saveState();
            }
            }
            closeModal();
        });
    });

    // Bind header width selects for existing persisted blocks
    function bindHeaderWidthControls(root){
        (root || document).querySelectorAll('li .header-width').forEach(sel => {
            sel.addEventListener('change', function(){
                const li = this.closest('li');
                const blockId = li.getAttribute('data-block-id');
                
                // Prevent width changes on locked blocks
                if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
                    // Reset to original value
                    const originalVal = li.getAttribute('data-width') || 'full';
                    this.value = originalVal;
                    Swal.fire({
                        icon: 'warning',
                        title: 'Block is Locked',
                        text: 'Cannot change width of a locked block. Unlock it first.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    return;
                }
                
                const val = this.value || 'full';
                li.setAttribute('data-width', val);
                updateBlockWidthClasses(li, val);
                li.querySelectorAll('.hidden-width-input').forEach(inp => { inp.value = val; });
                
                // Mark as unsaved for auto-save
                if (typeof window.AutoSaveManager !== 'undefined' && !HistoryManager.isExecuting) {
                    window.AutoSaveManager.markUnsaved();
                }
            });
        });
    }
    bindHeaderWidthControls();

    // Live per-block preview and page preview
    // depth parameter prevents infinite recursion
    function renderBlockPreview(container, type, content, depth = 0){
        try {
            // Prevent infinite recursion
            if(depth > 5){
                container.innerHTML = '<div class="text-sm text-gray-500 p-2">Max nesting depth reached</div>';
                return;
            }
            container.innerHTML = '';
            const c = content || {};
            if(type === 'heading'){
                // Handle both numeric and string level formats
                let level = c.level || 'h2';
                if(typeof level === 'number'){
                    level = `h${Math.min(6, Math.max(1, level))}`;
                } else if(typeof level === 'string' && !level.startsWith('h')){
                    level = `h${Math.min(6, Math.max(1, parseInt(level) || 2))}`;
                }
                if(!level.startsWith('h')) level = 'h2';
                const alignment = c.alignment || 'left';
                const alignClass = alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left';
                const sizeClasses = {
                    h1: 'text-2xl',
                    h2: 'text-xl',
                    h3: 'text-lg',
                    h4: 'text-base',
                    h5: 'text-sm',
                    h6: 'text-xs'
                };
                const sizeClass = sizeClasses[level] || 'text-xl';
                
                // Build style attributes
                const styles = [];
                const fontColor = c.fontColor || '#000000';
                styles.push(`color: ${fontColor}`);
                
                // Height
                const height = c.height || 'auto';
                if(height !== 'auto'){
                    styles.push(`min-height: ${height}`);
                }
                
                // Background
                const backgroundType = c.backgroundType || 'none';
                if(backgroundType === 'color' && c.backgroundColor){
                    styles.push(`background-color: ${c.backgroundColor}`);
                } else if(backgroundType === 'image' && c.backgroundImage){
                    styles.push(`background-image: url('${c.backgroundImage.replace(/'/g, "\\'")}')`);
                    styles.push(`background-size: cover`);
                    styles.push(`background-position: center`);
                    styles.push(`background-repeat: no-repeat`);
                }
                
                const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
                
                container.innerHTML = `<${level} class="${sizeClass} font-semibold ${alignClass}"${styleAttr}>${c.text || 'Heading'}</${level}>`;
            } else if(type === 'richtext'){
                const style = c.style || 'normal';
                const htmlContent = c.html || '<p>...</p>';
                
                // Build style attributes
                const styles = [];
                
                // Height
                const height = c.height || 'auto';
                if(height !== 'auto'){
                    styles.push(`min-height: ${height}`);
                }
                
                // Padding
                const padding = c.padding || '';
                if(padding){
                    styles.push(`padding: ${padding}`);
                }
                
                // Background
                const backgroundType = c.backgroundType || 'none';
                if(backgroundType === 'color' && c.backgroundColor){
                    styles.push(`background-color: ${c.backgroundColor}`);
                } else if(backgroundType === 'image' && c.backgroundImage){
                    styles.push(`background-image: url('${c.backgroundImage.replace(/'/g, "\\'")}')`);
                    styles.push(`background-size: cover`);
                    styles.push(`background-position: center`);
                    styles.push(`background-repeat: no-repeat`);
                }
                
                const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
                
                container.innerHTML = `<div class="prose max-w-none"${styleAttr}>${htmlContent}</div>`;
            } else if(type === 'image'){
                const src = c.src || '';
                const alt = c.alt || '';
                const caption = c.caption || '';
                const width = c.width || 'full';
                const widthClass = width === 'half' ? 'max-w-md mx-auto' : width === 'third' ? 'max-w-sm mx-auto' : 'w-full';
                // Helper function to resolve image URL
                function resolveImageUrl(url){
                    if(!url) return '';
                    // If data URL (base64), return as is
                    if(url.startsWith('data:image/')){
                        return url;
                    }
                    // If already absolute URL, return as is
                    if(url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')){
                        return url;
                    }
                    // If starts with /, return as relative path
                    if(url.startsWith('/')){
                        return url;
                    }
                    // Assume storage path
                    return '/storage/' + url;
                }
                const resolvedSrc = resolveImageUrl(src);
                
                // Check if we have a valid image source
                if(!src || src === '/images/sample.jpg'){
                    container.innerHTML = `<div class="${widthClass} p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
                        <i class="fas fa-image text-4xl text-gray-400 mb-2"></i>
                        <p class="text-sm text-gray-500">No image selected</p>
                        ${caption ? `<p class="text-sm text-gray-600 mt-2 italic">${caption}</p>` : ''}
                    </div>`;
                } else {
                    let html = `<div class="${widthClass}"><img src="${resolvedSrc}" alt="${alt}" class="w-full rounded" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'p-4 border-2 border-dashed border-gray-300 rounded text-center text-sm text-gray-500\\'><i class=\\'fas fa-image mr-2\\'></i>Image not found: ${src.replace(/\"/g, '&quot;')}</div>';">`;
                    if(caption){
                        html += `<p class="text-sm text-gray-600 mt-2 text-center italic">${caption}</p>`;
                    }
                    html += `</div>`;
                    container.innerHTML = html;
                }
            } else if(type === 'gallery'){
                const images = c.images || [];
                const display = c.display || 'grid';
                const autoplay = c.autoplay || false;
                
                // Helper function to resolve image URL
                function resolveImageUrl(url){
                    if(!url) return '';
                    // If data URL (base64), return as is
                    if(url.startsWith('data:image/')){
                        return url;
                    }
                    // If already absolute URL, return as is
                    if(url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')){
                        return url;
                    }
                    // If starts with /, return as relative path
                    if(url.startsWith('/')){
                        return url;
                    }
                    // Assume storage path
                    return '/storage/' + url;
                }
                
                if(images.length === 0){
                    container.innerHTML = `<div class="p-4 border-2 border-dashed border-gray-300 rounded text-center text-sm text-gray-500">
                        <i class="fas fa-images mr-2"></i>No images added yet
                    </div>`;
                } else if(display === 'slider'){
                    // Slider display - compact for preview
                    let sliderHtml = `<div class="relative">
                        <div class="flex overflow-x-auto gap-2 snap-x snap-mandatory" style="scroll-behavior: smooth;">
                            ${images.map((img, idx) => {
                                const resolvedSrc = resolveImageUrl(img.src);
                                return `
                                <div class="flex-none w-full snap-start">
                                    <img src="${resolvedSrc}" alt="${img.alt || ''}" class="w-full h-32 object-cover rounded border" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzljYTNkZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';">
                                </div>
                            `;
                            }).join('')}
                        </div>
                        ${images.length > 1 ? `
                            <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                                ${images.map((_, idx) => `<div class="w-2 h-2 rounded-full bg-white opacity-60 border"></div>`).join('')}
                            </div>
                        ` : ''}
                        <div class="mt-1 text-xs text-gray-500 text-center">${images.length} image${images.length !== 1 ? 's' : ''} (Slider)</div>
                    </div>`;
                    container.innerHTML = sliderHtml;
                } else {
                    // Grid display - compact for preview
                    const gridCols = images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : images.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
                    let gridHtml = `<div class="grid ${gridCols} gap-2">
                        ${images.map(img => {
                            const resolvedSrc = resolveImageUrl(img.src);
                            return `
                            <div class="relative">
                                <img src="${resolvedSrc}" alt="${img.alt || ''}" class="w-full h-24 object-cover rounded border" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzljYTNkZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';">
                            </div>
                        `;
                        }).join('')}
                    </div>`;
                    gridHtml += `<div class="mt-1 text-xs text-gray-500 text-center">${images.length} image${images.length !== 1 ? 's' : ''} (Grid)</div>`;
                    container.innerHTML = gridHtml;
                }
            } else if(type === 'code'){
                const code = c.code || '';
                if(!code || code.trim() === ''){
                    // container.innerHTML = `<div class="p-4 border-2 border-dashed border-gray-300 rounded text-center text-sm text-gray-500">
                    //     <i class="fas fa-code mr-2"></i>No code entered yet
                    // </div>`;
                } else {
                    // Show a preview of the code (first few lines)
                    const lines = code.split('\n');
                    const previewLines = lines.slice(0, 5);
                    const remainingLines = lines.length - 5;
                    const preview = previewLines.join('\n');
                    const isLonger = lines.length > 5;
                    
                    // Escape HTML for display
                    const escapedCode = preview.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    let html = `<div class="border rounded bg-gray-900 text-green-400 p-3 text-xs font-mono overflow-x-auto">
                        <pre class="whitespace-pre-wrap">${escapedCode}${isLonger ? '\n...' : ''}</pre>
                    </div>`;
                    if(isLonger){
                        html += `<div class="mt-1 text-xs text-gray-500 text-center">${lines.length} lines total (click to edit)</div>`;
                    } else {
                        html += `<div class="mt-1 text-xs text-gray-500 text-center">${lines.length} line${lines.length !== 1 ? 's' : ''}</div>`;
                    }
                    container.innerHTML = html;
                }
            } else if(type === 'map'){
                const lat = c.latitude || 34.0522;
                const lng = c.longitude || -118.2437;
                const zoom = c.zoom || 12;
                const address = c.address || '';
                
                // Generate Google Maps embed URL
                const mapUrl = `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodeURIComponent(lat + ',' + lng)}&zoom=${zoom}`;
                
                // For preview, we'll use a static map image or iframe
                // Note: Google Maps requires an API key. For preview, we'll show a placeholder with coordinates
                container.innerHTML = `<div class="border rounded bg-gray-100 relative" style="height: 300px;">
                    <div class="absolute inset-0 flex items-center justify-center bg-gray-200 border-2 border-dashed border-gray-400">
                        <div class="text-center p-4">
                            <i class="fas fa-map-marker-alt text-3xl text-gray-500 mb-2"></i>
                            <p class="text-sm font-medium text-gray-700">${address || 'Map Location'}</p>
                            <p class="text-xs text-gray-500 mt-1">Lat: ${lat}, Lng: ${lng}</p>
                            <p class="text-xs text-gray-500">Zoom: ${zoom}</p>
                        </div>
                    </div>
                    ${address ? `<div class="absolute bottom-2 left-2 bg-white px-2 py-1 rounded text-xs shadow">${address}</div>` : ''}
                </div>`;
            } else if(type === 'testimonial'){
                const quote = c.quote || 'Great service!';
                const author = c.author || 'Jane Doe';
                const source = c.source || 'Company X';
                const image = c.image || '';
                
                // Helper function to resolve image URL
                function resolveImageUrl(src) {
                    if(!src || src.trim() === '') return null;
                    if(src.startsWith('data:')) return src; // Base64 data URL
                    if(src.startsWith('http://') || src.startsWith('https://')) return src; // Absolute URL
                    if(src.startsWith('/')) return src; // Relative path
                    return '/storage/' + src; // Storage path
                }
                
                const imgUrl = resolveImageUrl(image);
                
                container.innerHTML = `<div class="border rounded bg-white p-6 shadow-sm">
                    <div class="flex items-start space-x-4">
                        ${imgUrl ? `<img src="${imgUrl}" alt="${author}" class="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0" onerror="this.style.display='none'; this.nextElementSibling?.classList.remove('hidden');">
                            <div class="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-200 flex-shrink-0 hidden flex items-center justify-center"><i class="fas fa-user  text-gray-400 text-xl"></i></div>` : `<div class="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-200 flex-shrink-0 flex items-center justify-center"><i class="fas fa-user  text-gray-400 text-xl"></i></div>`}
                        <div class="flex-1">
                            <div class="mb-3">
                                <svg class="w-8 h-8 text-blue-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-3.312.817-5.546 3.133-5.546 6.688 0 3.41 2.364 5.985 5.546 6.688v7.391h-10zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-3.312.817-5.546 3.133-5.546 6.688 0 3.41 2.361 5.985 5.546 6.688v7.391h-10z"/>
                                </svg>
                                <p class="text-gray-700 italic text-base leading-relaxed">"${quote}"</p>
                            </div>
                            <div class="border-t pt-3">
                                <p class="font-semibold text-gray-900">${author}</p>
                                ${source ? `<p class="text-sm text-gray-600">${source}</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
            } else if(type === 'two_column' || type === 'three_column'){
                const columns = c.columns || [];
                if(columns.length === 0){
                    container.innerHTML = `<div class="p-4 border-2 border-dashed border-gray-300 rounded text-center text-sm text-gray-500">
                        <p>${type === 'two_column' ? 'Two' : 'Three'} Column Layout</p>
                        <p class="text-xs mt-1">Click to add blocks to columns</p>
                    </div>`;
                } else {
                    const gridCols = type === 'two_column' ? 'grid-cols-2' : 'grid-cols-3';
                    let html = `<div class="grid ${gridCols} gap-4">`;
                    columns.forEach((col, idx) => {
                        const blocks = col.blocks || [];
                        html += `<div class="border-2 border-dashed border-gray-200 rounded-lg p-3 min-h-[100px] bg-gray-50 column-preview" data-column-index="${idx}">`;
                        html += `<div class="text-xs font-medium text-gray-600 mb-2">Column ${idx + 1}</div>`;
                        if(blocks.length === 0){
                            html += `<div class="text-xs text-gray-400 text-center py-4">Empty column</div>`;
                        } else {
                            blocks.forEach((block, blockIdx) => {
                                html += `<div class="mb-2 p-2 bg-white border rounded nested-block-preview" data-nested-type="${block.type || 'unknown'}" data-nested-content='${JSON.stringify(block.content || {}).replace(/'/g, "&#39;")}'>`;
                                html += `</div>`;
                            });
                        }
                        html += `</div>`;
                    });
                    html += `</div>`;
                    container.innerHTML = html;
                    
                    // Now render the nested block previews properly
                    container.querySelectorAll('.nested-block-preview').forEach(nestedPreview => {
                        const nestedType = nestedPreview.getAttribute('data-nested-type');
                        const nestedContentStr = nestedPreview.getAttribute('data-nested-content');
                        try {
                            const nestedContent = JSON.parse(nestedContentStr.replace(/&#39;/g, "'"));
                            const nestedContainer = document.createElement('div');
                            nestedPreview.appendChild(nestedContainer);
                            renderBlockPreview(nestedContainer, nestedType, nestedContent, depth + 1);
                        } catch(e){
                            nestedPreview.innerHTML = '<div class="text-xs text-gray-500">Error rendering nested block</div>';
                        }
                    });
                }
            } else if(type === 'blog_list'){
                const limit = c.limit || 3;
                const layout = c.layout || 'cards';
                const items = Array.from({length: limit}).map((_,i)=>({title:`Blog ${i+1}`,excerpt:'Short excerpt...'}));
                if(layout==='list'){
                    container.innerHTML = items.map(it=>`<div class="py-2 border-b"><div class="font-medium">${it.title}</div><div class="text-gray-600 text-sm">${it.excerpt}</div></div>`).join('');
                } else {
                    container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-3">` + items.map(it=>`<div class="border rounded p-3"><div class="font-medium mb-1">${it.title}</div><div class="text-gray-600 text-sm">${it.excerpt}</div></div>`).join('') + `</div>`;
                }
            } else if(type === 'blog_featured'){
                container.innerHTML = `<div class="border rounded p-4 bg-yellow-50"><div class="font-semibold">Featured Post</div><div class="text-gray-600 text-sm">Select a post in content</div></div>`;
            } else if(type === 'divider'){
                const style = c.style || 'solid';
                const color = c.color || '#ccc';
                const width = c.width || 'full';
                const borderStyle = style === 'dashed' ? 'dashed' : style === 'dotted' ? 'dotted' : 'solid';
                container.innerHTML = `<div style="border-top: 2px ${borderStyle} ${color}; margin: 10px 0; width: ${width === 'full' ? '100%' : '50%'}"></div>`;
            } else if(type === 'spacer'){
                let height = '40px';
                if(c.height){
                    height = c.height;
                } else if(c.size){
                    const sizeMap = {small: '20px', medium: '40px', large: '60px', xlarge: '80px'};
                    height = sizeMap[c.size] || '40px';
                }
                container.innerHTML = `<div style="height: ${height}; background: repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 10px, #f8f8f8 10px, #f8f8f8 20px); border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #999; font-size: 11px;">${height}</div>`;
            } else if(type === 'button'){
                const text = c.text || 'Click Me';
                const url = c.url || '#';
                const target = c.target || '_self';
                const style = c.style || 'primary';
                const position = c.position || 'left';
                const styleClasses = {
                    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
                    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
                    danger: 'bg-red-600 hover:bg-red-700 text-white',
                    success: 'bg-green-600 hover:bg-green-700 text-white',
                    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
                    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
                    link: 'text-blue-600 hover:underline'
                };
                const btnClass = styleClasses[style] || styleClasses.primary;
                const alignClass = position === 'center' ? 'text-center' : position === 'right' ? 'text-right' : 'text-left';
                container.innerHTML = `<div class="${alignClass}"><a href="${url}" target="${target}" class="inline-block px-4 py-2 rounded-lg font-medium transition-colors ${btnClass}">${text}</a></div>`;
            } else if(type === 'video'){
                const videoType = c.type || 'youtube';
                const id = c.id || '';
                const src = c.src || '';
                const autoplay = c.autoplay || false;
                const loop = c.loop || false;
                const mute = c.mute || false;
                
                if(videoType === 'youtube' && id){
                    const params = new URLSearchParams();
                    if(autoplay) params.append('autoplay', '1');
                    if(loop) params.append('loop', '1');
                    if(mute) params.append('mute', '1');
                    params.append('rel', '0');
                    const url = `https://www.youtube.com/embed/${id}?${params.toString()}`;
                    container.innerHTML = `<div class="relative w-full" style="padding-bottom: 56.25%;"><iframe class="absolute top-0 left-0 w-full h-full border rounded" src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
                } else if(videoType === 'vimeo' && id){
                    const params = new URLSearchParams();
                    if(autoplay) params.append('autoplay', '1');
                    if(loop) params.append('loop', '1');
                    if(mute) params.append('muted', '1');
                    const url = `https://player.vimeo.com/video/${id}?${params.toString()}`;
                    container.innerHTML = `<div class="relative w-full" style="padding-bottom: 56.25%;"><iframe class="absolute top-0 left-0 w-full h-full border rounded" src="${url}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
                } else if(videoType === 'self_hosted' && src){
                    const autoplayAttr = autoplay ? 'autoplay' : '';
                    const loopAttr = loop ? 'loop' : '';
                    const mutedAttr = mute ? 'muted' : '';
                    container.innerHTML = `<video class="w-full border rounded" controls ${autoplayAttr} ${loopAttr} ${mutedAttr}><source src="${src}" type="video/mp4">Your browser does not support the video tag.</video>`;
                } else {
                    container.innerHTML = `<div class="p-4 border rounded bg-gray-100 text-sm text-gray-600 text-center">Configure video settings</div>`;
                }
            } else if(type === 'hero_section'){
                const heading = c.heading || 'Welcome';
                const subheading = c.subheading || '';
                const backgroundType = c.background_type || 'color';
                const backgroundImageUrl = c.background_image_url || '';
                const backgroundVideoUrl = c.background_video_url || '';
                const backgroundColor = c.background_color || '#000000';
                const overlayColor = c.overlay_color || '#000000';
                const overlayOpacity = c.overlay_opacity ?? 0.5;
                const buttonText = c.button_text || '';
                const buttonUrl = c.button_url || '#';
                const buttonTarget = c.button_target || '_self';
                const alignment = c.alignment || 'center';
                const height = c.height || 'medium';
                const textColor = c.text_color || '#ffffff';
                
                // Height classes for preview
                const heightClasses = {
                    small: 'min-h-[150px]',
                    medium: 'min-h-[200px]',
                    large: 'min-h-[250px]',
                    full_screen: 'min-h-[300px]'
                };
                const heightClass = heightClasses[height] || heightClasses.medium;
                
                // Alignment classes
                const alignClasses = {
                    left: 'text-left items-start justify-start',
                    center: 'text-center items-center justify-center',
                    right: 'text-right items-end justify-end'
                };
                const alignClass = alignClasses[alignment] || alignClasses.center;
                
                // Build container styles
                const containerStyles = [];
                
                // Background styles
                if(backgroundType === 'color'){
                    containerStyles.push(`background-color: ${backgroundColor}`);
                } else if(backgroundType === 'image' && backgroundImageUrl){
                    let bgImage = backgroundImageUrl;
                    // Helper function to resolve image URL
                    function resolveImageUrl(url){
                        if(!url) return '';
                        if(url.startsWith('data:image/')) return url;
                        if(url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
                        if(url.startsWith('/')) return url;
                        return '/storage/' + url;
                    }
                    bgImage = resolveImageUrl(bgImage);
                    containerStyles.push(`background-image: url('${bgImage.replace(/'/g, "\\'")}')`);
                    containerStyles.push(`background-size: cover`);
                    containerStyles.push(`background-position: center`);
                    containerStyles.push(`background-repeat: no-repeat`);
                }
                
                const containerStyleAttr = containerStyles.length > 0 ? ` style="${containerStyles.join('; ')}"` : '';
                
                // Overlay style
                let overlayStyle = '';
                if(overlayOpacity > 0){
                    // Convert hex to rgba
                    function hexToRgba(hex, opacity){
                        hex = hex.replace('#', '');
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    }
                    overlayStyle = `background-color: ${hexToRgba(overlayColor, overlayOpacity)}`;
                }
                
                // Build preview HTML
                let html = `<div class="relative flex ${heightClass} ${alignClass} px-4 py-4 overflow-hidden rounded border-2 border-dashed border-gray-300"${containerStyleAttr}>`;
                
                // Video background (if applicable)
                if(backgroundType === 'video' && backgroundVideoUrl){
                    html += `<video autoplay muted loop playsinline class="absolute inset-0 w-full h-full object-cover opacity-50"><source src="${backgroundVideoUrl.replace(/'/g, "\\'")}" type="video/mp4"></video>`;
                }
                
                // Overlay
                if(overlayOpacity > 0){
                    html += `<div class="absolute inset-0" style="${overlayStyle}"></div>`;
                }
                
                // Content
                html += `<div class="relative z-10 max-w-4xl w-full" style="color: ${textColor};">`;
                html += `<h1 class="text-2xl md:text-3xl font-bold mb-2">${heading.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>`;
                if(subheading){
                    html += `<p class="text-sm md:text-base mb-3">${subheading.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
                }
                if(buttonText){
                    html += `<a href="${buttonUrl.replace(/'/g, "\\'")}" target="${buttonTarget}" class="inline-block px-4 py-2 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">${buttonText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>`;
                }
                html += `</div>`;
                
                // Background type indicator
                html += `<div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">${backgroundType.toUpperCase()}</div>`;
                
                html += `</div>`;
                
                container.innerHTML = html;
            } else {
                container.innerHTML = `<pre class="text-xs">${JSON.stringify(c, null, 2)}</pre>`;
            }
        } catch(e){ container.textContent = 'Preview unavailable'; }
    }

    function parseContent(text){
        try { return JSON.parse(text); } catch(e) { return { raw: text }; }
    }

    function refreshAllPreviews(){
        document.querySelectorAll('.block-preview').forEach(preview => {
            const li = preview.closest('li');
            const type = preview.getAttribute('data-type');
            const textarea = li.querySelector('textarea.block-content-input');
            let contentSrc = '{}';
            if(textarea){ contentSrc = textarea.value; }
            else { contentSrc = preview.getAttribute('data-content') || '{}'; }
                renderBlockPreview(preview, type, parseContent(contentSrc), 0);
        });
    }

    // Initial render
    refreshAllPreviews();

    // Setup editors for existing blocks AND temp blocks
    // Find all blocks - both saved (with data-block-id) and temp (with data-temp-id)
    const savedBlocks = document.querySelectorAll('li[data-block-id]');
    const tempBlocks = document.querySelectorAll('li[data-temp-id]');
    const allBlocks = Array.from(savedBlocks).concat(Array.from(tempBlocks));
    
    allBlocks.forEach((li, index) => {
        const preview = li.querySelector('.block-preview');
        if(!preview) {
            return;
        }
        
        const blockType = preview.getAttribute('data-type');
        
        if(blockType === 'divider'){
            setupDividerEditor(li);
        } else if(blockType === 'spacer'){
            setupSpacerEditor(li);
        } else if(blockType === 'button'){
            setupButtonEditor(li);
        } else if(blockType === 'video'){
            setupVideoEditor(li);
        } else if(blockType === 'richtext'){
            setupRichTextEditor(li);
        } else if(blockType === 'image'){
            setupImageEditor(li);
        } else if(blockType === 'gallery'){
            setupGalleryEditor(li);
        } else if(blockType === 'code'){
            setupCodeEditor(li);
        } else if(blockType === 'map'){
            setupMapEditor(li);
        } else if(blockType === 'testimonial'){
            setupTestimonialEditor(li);
        } else if(blockType === 'heading'){
            setupHeadingEditor(li);
        } else if(blockType === 'hero_section'){
            setupHeroSectionEditor(li);
        }
    });

    // Helper function to update edit button icon based on edit state
    function updateEditButtonIcon(li, isEditing) {
        if(!li) return;
        
        const editBtn = li.querySelector('.block-edit-toggle-btn');
        if(!editBtn) return;
        
        const iconElement = editBtn.querySelector('i');
        if(!iconElement) return;
        
        // Remove existing icon classes
        iconElement.className = iconElement.className.replace(/fa-edit|fa-check|fa-save/g, '').trim();
        
        if(isEditing) {
            // Show check/tick icon when in edit mode
            iconElement.classList.add('fas', 'fa-check', 'text-xs');
            editBtn.setAttribute('title', 'Save Changes');
        } else {
            // Show edit/pencil icon when not in edit mode
            iconElement.classList.add('fas', 'fa-edit', 'text-xs');
            editBtn.setAttribute('title', 'Edit Block');
        }
    }

    // Initialize edit button icons for all blocks on page load
    function initializeEditButtonIcons() {
        document.querySelectorAll('li[data-block-id], li[data-temp-id]').forEach(li => {
            const editForm = li.querySelector('.block-edit-form');
            if(editForm) {
                const isHidden = editForm.classList.contains('hidden') || window.getComputedStyle(editForm).display === 'none';
                updateEditButtonIcon(li, !isHidden);
            } else {
                // Default to edit icon if form not found
                updateEditButtonIcon(li, false);
            }
        });
    }

    // Initialize icons on page load
    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeEditButtonIcons);
    } else {
        // DOM already loaded
        initializeEditButtonIcons();
    }

    // Helper function to toggle edit form and update icon
    function toggleEditForm(li, editForm, preview) {
        if(!li || !editForm || !preview) return false;
        
        const isHidden = editForm.classList.contains('hidden') || window.getComputedStyle(editForm).display === 'none';
        if(isHidden) {
            // Open edit form
            editForm.classList.remove('hidden');
            editForm.style.display = 'block';
            editForm.style.visibility = 'visible';
            editForm.style.cssText = editForm.style.cssText.replace(/display:\s*none[^;]*;?/gi, '');
            editForm.style.cssText += '; display: block !important; visibility: visible !important;';
            preview.classList.add('hidden');
            preview.style.cssText += '; display: none !important;';
            updateEditButtonIcon(li, true);
            return true;
        } else {
            // Close edit form
            editForm.classList.add('hidden');
            editForm.style.cssText += '; display: none !important;';
            preview.classList.remove('hidden');
            preview.style.cssText += '; display: block !important;';
            updateEditButtonIcon(li, false);
            return false;
        }
    }

    // Wire up preview clicks to toggle edit form (centralized handler)
    document.addEventListener('click', function(e) {
        const preview = e.target.closest('.block-preview');
        if(preview && !e.target.closest('.block-edit-toggle-btn')) {
            const li = preview.closest('li');
            if(li) {
                // Prevent editing locked blocks
                const blockId = li.getAttribute('data-block-id');
                if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
                    return;
                }
                
                const editForm = li.querySelector('.block-edit-form');
                if(editForm) {
                    // Check if form is currently hidden - if so, toggle it open
                    const isHidden = editForm.classList.contains('hidden') || window.getComputedStyle(editForm).display === 'none';
                    if(isHidden) {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleEditForm(li, editForm, preview);
                    }
                }
            }
        }
    });

    // Wire up edit toggle buttons for all blocks
    document.addEventListener('click', function(e) {
        const editBtn = e.target.closest('.block-edit-toggle-btn');
        if(editBtn) {
            e.preventDefault();
            e.stopPropagation();
            const li = editBtn.closest('li');
            if(li) {
                // Prevent editing locked blocks
                const blockId = li.getAttribute('data-block-id');
                if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Block is Locked',
                        text: 'Cannot edit a locked block. Unlock it first.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    return;
                }
                
                const blockType = editBtn.getAttribute('data-block-type') || (li.querySelector('.block-preview')?.getAttribute('data-type'));
                // Try multiple ways to find the form
                let editForm = li.querySelector('.block-edit-form');
                if(!editForm) {
                    // Try finding it in the mt-3 div
                    const mt3Div = li.querySelector('.mt-3');
                    if(mt3Div) {
                        editForm = mt3Div.querySelector('.block-edit-form');
                        // Also try finding any form in mt-3
                        if(!editForm) {
                            const formsInMt3 = mt3Div.querySelectorAll('form');
                            if(formsInMt3.length > 0) {
                                editForm = formsInMt3[0];
                            }
                        }
                    }
                }
                // Try finding it as a direct child
                if(!editForm) {
                    editForm = li.querySelector('form.block-edit-form');
                }
                // Try finding any form in li
                if(!editForm) {
                    const allForms = li.querySelectorAll('form');
                    if(allForms.length > 0) {
                        // Find the one with block-edit-form class
                        for(let form of allForms) {
                            if(form.classList.contains('block-edit-form')) {
                                editForm = form;
                                break;
                            }
                        }
                        // If still not found, use the first form that's not a toggle-width-form or delete form
                        if(!editForm && allForms.length > 0) {
                            for(let form of allForms) {
                                if(!form.classList.contains('toggle-width-form') && !form.hasAttribute('onsubmit')) {
                                    editForm = form;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Last resort: Check the mt-3 div's children directly
                if(!editForm) {
                    const mt3Div = li.querySelector('.mt-3');
                    if(mt3Div) {
                        // Check all children of mt-3
                        for(let child of mt3Div.children) {
                            if(child.tagName === 'FORM') {
                                editForm = child;
                                break;
                            }
                        }
                        // If still not found, search deeper in mt-3
                        if(!editForm) {
                            const formInMt3 = mt3Div.querySelector('form');
                            if(formInMt3) {
                                editForm = formInMt3;
                            }
                        }
                    }
                }
                
                const preview = li.querySelector('.block-preview');
                
                if(editForm && preview) {
                    // Use helper function to toggle and update icon
                    toggleEditForm(li, editForm, preview);
                } else {
                    // Debug: Log full li structure
                    console.error('Edit form or preview not found for block type:', blockType, {
                        hasLi: !!li,
                        hasEditForm: !!editForm,
                        hasPreview: !!preview,
                        liHTML: li.outerHTML.substring(0, 3000),
                        liChildren: li ? Array.from(li.children).map(c => ({
                            tag: c.tagName,
                            classes: c.className,
                            childrenCount: c.children.length,
                            firstChildTag: c.children.length > 0 ? c.children[0].tagName : null,
                            html: c.outerHTML.substring(0, 500)
                        })) : [],
                        allFormsInLi: li ? Array.from(li.querySelectorAll('form')).map(f => ({
                            className: f.className,
                            action: f.action,
                            method: f.method
                        })) : [],
                        mt3Div: li ? (() => {
                            const mt3 = li.querySelector('.mt-3');
                            return mt3 ? {
                                exists: true,
                                childrenCount: mt3.children.length,
                                childrenTags: Array.from(mt3.children).map(c => c.tagName),
                                html: mt3.outerHTML.substring(0, 500)
                            } : { exists: false };
                        })() : null
                    });
                    
                    // If form truly not found, try to create/find it differently
                    if(!editForm && li) {
                        const mt3Div = li.querySelector('.mt-3');
                        if(mt3Div) {
                            // Try to find form by action URL pattern
                            const allElements = mt3Div.querySelectorAll('*');
                            for(let el of allElements) {
                                if(el.tagName === 'FORM' && el.action && el.action.includes('/blocks/update')) {
                                    editForm = el;
                                    console.log('Found form by action pattern:', editForm);
                                    break;
                                }
                            }
                        }
                    }
                    
                    // If still found, try the toggle
                    if(editForm && preview) {
                        // Use helper function to toggle and update icon
                        toggleEditForm(li, editForm, preview);
                    }
                }
            }
        }
    });

    // Click outside handler to close edit forms
    document.addEventListener('click', function(e) {
        // Don't close if clicking on toggle button, inside edit form, or on preview
        const editBtn = e.target.closest('.block-edit-toggle-btn');
        const editForm = e.target.closest('.block-edit-form');
        const preview = e.target.closest('.block-preview');
        
        if(editBtn || editForm || preview) {
            return; // Don't close if clicking inside form, on toggle button, or on preview
        }
        
        // Find all open edit forms and close them
        document.querySelectorAll('.block-edit-form').forEach(form => {
            const isHidden = form.classList.contains('hidden');
            const isDisplayNone = window.getComputedStyle(form).display === 'none';
            
            if(!isHidden && !isDisplayNone) {
                const li = form.closest('li');
                if(li) {
                    const previewElement = li.querySelector('.block-preview');
                    if(previewElement) {
                        // Close the form and show preview
                        form.classList.add('hidden');
                        form.style.cssText = 'display: none !important;';
                        previewElement.classList.remove('hidden');
                        previewElement.style.cssText = 'display: block !important;';
                        
                        // Update icon to edit/pencil when closing edit form
                        updateEditButtonIcon(li, false);
                        
                        // Refresh previews to show updated content
                        if(typeof refreshAllPreviews === 'function') {
                            refreshAllPreviews();
                        }
                    }
                }
            }
        });
    });

    // Wire up duplicate buttons for existing blocks
    document.addEventListener('click', function(e) {
        const duplicateBtn = e.target.closest('.block-duplicate-btn');
        if(duplicateBtn) {
            e.preventDefault();
            e.stopPropagation();
            const li = duplicateBtn.closest('li');
            if(li) {
                duplicateBlock(li);
            }
        }
    });

    // Wire up divider form submissions for existing blocks
    document.querySelectorAll('.block-edit-form').forEach(form => {
        const li = form.closest('li');
        const preview = li ? li.querySelector('.block-preview') : null;
        if(preview && preview.getAttribute('data-type') === 'divider'){
            const contentInput = form.querySelector('.divider-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const styleSelect = form.querySelector('.divider-style-select');
            const colorInput = form.querySelector('.divider-color-input');
            const colorText = form.querySelector('.divider-color-text');
            const widthSelect = form.querySelector('.divider-width-select');

            function updateDividerContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    const newContent = {
                        style: styleSelect ? styleSelect.value : (currentContent.style || 'solid'),
                        color: colorInput ? colorInput.value : (currentContent.color || '#ccc'),
                        width: widthSelect ? widthSelect.value : (currentContent.width || 'full')
                    };
                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
    refreshAllPreviews();
                } catch(e){}
            }

            if(styleSelect){
                styleSelect.addEventListener('change', updateDividerContent);
            }
            if(colorInput && colorText){
                colorInput.addEventListener('input', () => {
                    colorText.value = colorInput.value;
                    updateDividerContent();
                });
                colorText.addEventListener('input', () => {
                    if(/^#[0-9A-F]{6}$/i.test(colorText.value)){
                        colorInput.value = colorText.value;
                        updateDividerContent();
                    }
                });
            }
            if(widthSelect){
                widthSelect.addEventListener('change', updateDividerContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateDividerContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'spacer'){
            const contentInput = form.querySelector('.spacer-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const sizeSelect = form.querySelector('.spacer-size-select');
            const heightSlider = form.querySelector('.spacer-height-slider');
            const heightText = form.querySelector('.spacer-height-text');
            const heightDisplay = form.querySelector('.spacer-height-display');

            const sizeMap = {small: '20px', medium: '40px', large: '60px', xlarge: '80px'};

            function updateSpacerContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    let height = currentContent.height || '40px';
                    
                    // If size is selected, use that
                    if(sizeSelect && sizeSelect.value){
                        height = sizeMap[sizeSelect.value] || height;
                    } else if(heightSlider){
                        height = heightSlider.value + 'px';
                    }
                    
                    // Update text input and display
                    if(heightText) heightText.value = height;
                    if(heightDisplay) heightDisplay.textContent = height;
                    if(heightSlider) heightSlider.value = parseInt(height.replace('px', '')) || 40;

                    const newContent = {
                        height: height
                    };
                    
                    // If size was selected, also include it
                    if(sizeSelect && sizeSelect.value){
                        newContent.size = sizeSelect.value;
                    }

                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
    refreshAllPreviews();
                } catch(e){}
            }

            // Wire size dropdown
            if(sizeSelect){
                sizeSelect.addEventListener('change', () => {
                    if(sizeSelect.value){
                        const sizeHeight = sizeMap[sizeSelect.value];
                        if(heightSlider) heightSlider.value = parseInt(sizeHeight.replace('px', ''));
                        if(heightText) heightText.value = sizeHeight;
                    }
                    updateSpacerContent();
                });
            }

            // Wire height slider
            if(heightSlider){
                heightSlider.addEventListener('input', () => {
                    const height = heightSlider.value + 'px';
                    if(heightText) heightText.value = height;
                    if(heightDisplay) heightDisplay.textContent = height;
                    if(sizeSelect) sizeSelect.value = ''; // Clear size selection when using slider
                    updateSpacerContent();
                });
            }

            // Wire height text input
            if(heightText){
                heightText.addEventListener('input', () => {
                    const value = heightText.value.trim();
                    if(/^\d+px$/.test(value)){
                        const numValue = parseInt(value.replace('px', ''));
                        if(numValue >= 10 && numValue <= 200){
                            if(heightSlider) heightSlider.value = numValue;
                            if(heightDisplay) heightDisplay.textContent = value;
                            if(sizeSelect) sizeSelect.value = ''; // Clear size selection when using custom
                            updateSpacerContent();
                        }
                    }
                });
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateSpacerContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'button'){
            const contentInput = form.querySelector('.button-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const textInput = form.querySelector('.button-text-input');
            const urlInput = form.querySelector('.button-url-input');
            const targetSelect = form.querySelector('.button-target-select');
            const styleSelect = form.querySelector('.button-style-select');
            const positionSelect = form.querySelector('.button-position-select');

            function updateButtonContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    const newContent = {
                        text: textInput ? textInput.value : (currentContent.text || 'Click Me'),
                        url: urlInput ? urlInput.value : (currentContent.url || '/contact'),
                        target: targetSelect ? targetSelect.value : (currentContent.target || '_self'),
                        style: styleSelect ? styleSelect.value : (currentContent.style || 'primary'),
                        position: positionSelect ? positionSelect.value : (currentContent.position || 'left')
                    };

                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    refreshAllPreviews();
                } catch(e){}
            }

            // Wire all inputs
            if(textInput){
                textInput.addEventListener('input', updateButtonContent);
            }
            if(urlInput){
                urlInput.addEventListener('input', updateButtonContent);
            }
            if(targetSelect){
                targetSelect.addEventListener('change', updateButtonContent);
            }
            if(styleSelect){
                styleSelect.addEventListener('change', updateButtonContent);
            }
            if(positionSelect){
                positionSelect.addEventListener('change', updateButtonContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateButtonContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'video'){
            const contentInput = form.querySelector('.video-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const typeSelect = form.querySelector('.video-type-select');
            const urlInput = form.querySelector('.video-url-input');
            const srcInput = form.querySelector('.video-src-input');
            const urlField = form.querySelector('.video-url-field');
            const srcField = form.querySelector('.video-src-field');
            const autoplayCheckbox = form.querySelector('.video-autoplay-checkbox');
            const loopCheckbox = form.querySelector('.video-loop-checkbox');
            const muteCheckbox = form.querySelector('.video-mute-checkbox');

            // Helper function to extract video ID from URL
            function extractVideoId(url, type){
                if(!url) return '';
                try {
                    if(type === 'youtube'){
                        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
                        return match ? match[1] : '';
                    } else if(type === 'vimeo'){
                        const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
                        return match ? match[1] : '';
                    }
                } catch(e){}
                return '';
            }

            // Toggle fields based on video type
            function toggleFields(type){
                if(type === 'self_hosted'){
                    if(urlField) urlField.style.display = 'none';
                    if(srcField) srcField.style.display = 'block';
                } else {
                    if(urlField) urlField.style.display = 'block';
                    if(srcField) srcField.style.display = 'none';
                }
            }

            function updateVideoContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    const videoType = typeSelect ? typeSelect.value : (currentContent.type || 'youtube');
                    const newContent = {
                        type: videoType,
                        autoplay: autoplayCheckbox ? autoplayCheckbox.checked : (currentContent.autoplay || false),
                        loop: loopCheckbox ? loopCheckbox.checked : (currentContent.loop || false),
                        mute: muteCheckbox ? muteCheckbox.checked : (currentContent.mute || false)
                    };

                    if(videoType === 'self_hosted'){
                        newContent.src = srcInput ? srcInput.value : (currentContent.src || '');
                    } else {
                        const url = urlInput ? urlInput.value : '';
                        const id = extractVideoId(url, videoType);
                        newContent.id = id;
                    }

                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    refreshAllPreviews();
                } catch(e){}
            }

            // Wire type select to toggle fields
            if(typeSelect){
                typeSelect.addEventListener('change', () => {
                    toggleFields(typeSelect.value);
                    updateVideoContent();
                });
            }

            // Wire URL input
            if(urlInput){
                urlInput.addEventListener('input', updateVideoContent);
            }

            // Wire src input
            if(srcInput){
                srcInput.addEventListener('input', updateVideoContent);
            }

            // Wire checkboxes
            if(autoplayCheckbox){
                autoplayCheckbox.addEventListener('change', updateVideoContent);
            }
            if(loopCheckbox){
                loopCheckbox.addEventListener('change', updateVideoContent);
            }
            if(muteCheckbox){
                muteCheckbox.addEventListener('change', updateVideoContent);
            }

            // Initialize fields visibility
            if(typeSelect){
                toggleFields(typeSelect.value);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateVideoContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'richtext'){
            const contentInput = form.querySelector('.richtext-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                    const editor = form.querySelector('.richtext-editor');
                    if(editor) editor.focus();
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const styleSelect = form.querySelector('.richtext-style-select');
            const editor = form.querySelector('.richtext-editor');
            const toolbarBtns = form.querySelectorAll('.richtext-toolbar-btn');

            if(!editor) return;

            // Handle placeholder
            editor.addEventListener('focus', function() {
                if(this.textContent.trim() === (this.dataset.placeholder || 'Write something...')){
                    this.textContent = '';
                }
            });

            editor.addEventListener('blur', function() {
                if(this.textContent.trim() === ''){
                    this.textContent = this.dataset.placeholder || 'Write something...';
                }
            });

            function updateRichTextContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    const htmlContent = editor.innerHTML || '<p></p>';
                    const newContent = {
                        html: htmlContent,
                        style: styleSelect ? styleSelect.value : (currentContent.style || 'normal')
                    };

                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    refreshAllPreviews();
                } catch(e){}
            }

            // Wire toolbar buttons
            toolbarBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const command = this.dataset.command;
                    const arg = this.dataset.arg;
                    
                    editor.focus();
                    
                    if(command === 'formatBlock' && arg){
                        // Ensure we have a selection for formatBlock
                        const selection = window.getSelection();
                        if(selection.rangeCount === 0){
                            const range = document.createRange();
                            range.selectNodeContents(editor);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                        document.execCommand('formatBlock', false, arg);
                    } else if(this.classList.contains('richtext-link-btn')){
                        const selection = window.getSelection();
                        const selectedText = selection.toString();
                        const url = prompt(selectedText ? `Enter URL for "${selectedText}":` : 'Enter URL:');
                        if(url){
                            if(selectedText){
                                document.execCommand('createLink', false, url);
                            } else {
                                const linkText = prompt('Enter link text:', 'Link');
                                if(linkText){
                                    document.execCommand('insertHTML', false, `<a href="${url}">${linkText}</a>`);
                                }
                            }
                        }
                    } else if(this.classList.contains('richtext-table-btn')){
                        const rows = prompt('Enter number of rows:', '3');
                        const cols = prompt('Enter number of columns:', '3');
                        if(rows && cols && !isNaN(rows) && !isNaN(cols)){
                            const r = parseInt(rows);
                            const c = parseInt(cols);
                            let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;"><tbody>';
                            for(let i = 0; i < r; i++){
                                tableHTML += '<tr>';
                                for(let j = 0; j < c; j++){
                                    tableHTML += `<td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>`;
                                }
                                tableHTML += '</tr>';
                            }
                            tableHTML += '</tbody></table>';
                            document.execCommand('insertHTML', false, tableHTML);
                        }
                    } else {
                        // For list commands, ensure proper selection
                        if(command === 'insertUnorderedList' || command === 'insertOrderedList'){
                            // Ensure editor has focus first
                            editor.focus();
                            
                            // Use setTimeout to ensure focus is established
                            setTimeout(() => {
                                const selection = window.getSelection();
                                let range;
                                let blockElement = null;
                                
                                // Get current selection range if it exists
                                if(selection.rangeCount > 0){
                                    range = selection.getRangeAt(0);
                                    // Find the current block element from the range
                                    let node = range.commonAncestorContainer;
                                    if(node.nodeType === Node.TEXT_NODE){
                                        node = node.parentNode;
                                    }
                                    // Walk up to find a block element
                                    while(node && node !== editor && node.nodeType !== Node.DOCUMENT_NODE){
                                        if(node.nodeType === Node.ELEMENT_NODE){
                                            const tagName = node.tagName;
                                            if(tagName === 'P' || tagName === 'DIV' || tagName === 'LI' || 
                                               tagName === 'H1' || tagName === 'H2' || tagName === 'H3' || 
                                               tagName === 'H4' || tagName === 'H5' || tagName === 'H6'){
                                                blockElement = node;
                                                break;
                                            }
                                        }
                                        node = node.parentNode;
                                    }
                                }
                                
                                // If no block element found, create one
                                if(!blockElement || blockElement === editor){
                                    blockElement = document.createElement('p');
                                    
                                    if(selection.rangeCount > 0){
                                        try {
                                            const currentRange = selection.getRangeAt(0);
                                            // Insert at cursor position
                                            if(currentRange.startContainer.nodeType === Node.TEXT_NODE){
                                                const textNode = currentRange.startContainer;
                                                const parent = textNode.parentNode;
                                                const offset = currentRange.startOffset;
                                                
                                                if(offset === 0){
                                                    parent.insertBefore(blockElement, textNode);
                                                } else if(offset === textNode.length){
                                                    parent.insertBefore(blockElement, textNode.nextSibling);
                                                } else {
                                                    // Split text node and insert in between
                                                    const newNode = textNode.splitText(offset);
                                                    parent.insertBefore(blockElement, newNode);
                                                }
                                            } else {
                                                currentRange.insertNode(blockElement);
                                            }
                                            range = document.createRange();
                                            range.selectNodeContents(blockElement);
                                            range.collapse(false);
                                        } catch(e) {
                                            editor.appendChild(blockElement);
                                            range = document.createRange();
                                            range.selectNodeContents(blockElement);
                                            range.collapse(false);
                                        }
                                    } else {
                                        // If editor is empty or has no content, add paragraph
                                        if(editor.innerHTML.trim() === '' || editor.textContent.trim() === ''){
                                            editor.innerHTML = '<p></p>';
                                            blockElement = editor.querySelector('p');
                                        } else {
                                            editor.appendChild(blockElement);
                                        }
                                        if(!blockElement) blockElement = editor.querySelector('p') || document.createElement('p');
                                        range = document.createRange();
                                        range.selectNodeContents(blockElement);
                                        range.collapse(false);
                                    }
                                } else {
                                    // Select the found block element
                                    range = document.createRange();
                                    range.selectNodeContents(blockElement);
                                }
                                
                                // Set selection
                                selection.removeAllRanges();
                                selection.addRange(range);
                                
                                // Execute command
                                const success = document.execCommand(command, false, null);
                                
                                // If execCommand failed, manually create list
                                if(!success){
                                    const listTag = command === 'insertUnorderedList' ? 'ul' : 'ol';
                                    const content = blockElement.innerHTML || blockElement.textContent || 'List item';
                                    const listHtml = `<${listTag}><li>${content}</li></${listTag}>`;
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = listHtml;
                                    const listElement = tempDiv.firstElementChild;
                                    if(blockElement.parentNode){
                                        blockElement.parentNode.replaceChild(listElement, blockElement);
                                    } else {
                                        blockElement.outerHTML = listHtml;
                                    }
                                    // Restore selection to the first list item
                                    const firstLi = listElement.querySelector('li');
                                    if(firstLi){
                                        const newRange = document.createRange();
                                        newRange.selectNodeContents(firstLi);
                                        newRange.collapse(false);
                                        selection.removeAllRanges();
                                        selection.addRange(newRange);
                                    }
                                }
                                
                                // Trigger content update
                                updateRichTextContent();
                            }, 10);
                            
                            // Don't execute command here, it's done in setTimeout
                            return;
                        }
                        document.execCommand(command, false, null);
                    }
                    
                    updateRichTextContent();
                });
            });

            // Wire editor content changes
            editor.addEventListener('input', updateRichTextContent);
            editor.addEventListener('paste', function(e) {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text);
                updateRichTextContent();
            });

            // Wire style select
            if(styleSelect){
                styleSelect.addEventListener('change', updateRichTextContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateRichTextContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'image'){
            const contentInput = form.querySelector('.image-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const srcInput = form.querySelector('.image-src-input');
            const altInput = form.querySelector('.image-alt-input');
            const captionInput = form.querySelector('.image-caption-input');
            const widthSelect = form.querySelector('.image-width-select');
            const imagePreview = form.querySelector('.image-preview');

            function updateImageContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    const newContent = {
                        src: srcInput ? srcInput.value : (currentContent.src || ''),
                        alt: altInput ? altInput.value : (currentContent.alt || ''),
                        caption: captionInput ? captionInput.value : (currentContent.caption || ''),
                        width: widthSelect ? widthSelect.value : (currentContent.width || 'full')
                    };

                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    refreshAllPreviews();
                } catch(e){}
            }

            // Wire inputs
            if(srcInput){
                srcInput.addEventListener('input', () => {
                    // Update preview if URL changes
                    if(imagePreview && srcInput.value){
                        imagePreview.src = srcInput.value;
                        imagePreview.parentElement.style.display = 'block';
                    }
                    updateImageContent();
                });
            }
            if(altInput){
                altInput.addEventListener('input', updateImageContent);
            }
            if(captionInput){
                captionInput.addEventListener('input', updateImageContent);
            }
            if(widthSelect){
                widthSelect.addEventListener('change', updateImageContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateImageContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'gallery'){
            const contentInput = form.querySelector('.gallery-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const displaySelect = form.querySelector('.gallery-display-select');
            const autoplayCheckbox = form.querySelector('.gallery-autoplay-checkbox');
            const autoplayContainer = form.querySelector('.gallery-autoplay-container');
            const imagesList = form.querySelector('.gallery-images-list');
            const addImageBtn = form.querySelector('.gallery-add-image-btn');

            function updateGalleryContent(){
                try {
                    if(!imagesList || !contentInput) return;
                    
                    const images = [];
                    
                    // Collect all images from the list
                    const imageItems = imagesList.querySelectorAll('.gallery-image-item');
                    imageItems.forEach(item => {
                        const srcInput = item.querySelector('.gallery-image-src');
                        const altInput = item.querySelector('.gallery-image-alt');
                        const src = srcInput ? srcInput.value.trim() : '';
                        const alt = altInput ? altInput.value.trim() : '';
                        if(src){
                            images.push({src, alt});
                        }
                    });

                    const newContent = {
                        images: images,
                        display: displaySelect?.value || 'grid',
                        autoplay: autoplayCheckbox?.checked || false
                    };
                    
                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    refreshAllPreviews();
                } catch(e){
                    console.error('Error updating gallery content:', e);
                }
            }

            // Display type change
            if(displaySelect){
                displaySelect.addEventListener('change', () => {
                    const isSlider = displaySelect.value === 'slider';
                    if(autoplayContainer){
                        autoplayContainer.style.display = isSlider ? 'block' : 'none';
                    }
                    updateGalleryContent();
                });
            }

            // Autoplay checkbox
            if(autoplayCheckbox){
                autoplayCheckbox.addEventListener('change', updateGalleryContent);
            }

            // Add new image item
            function addGalleryImageItem(src, alt){
                const item = document.createElement('div');
                item.className = 'flex items-center gap-2 p-2 bg-gray-50 border rounded gallery-image-item';
                item.setAttribute('data-image-index', Date.now());
                
                const previewHtml = src ? `<div class="w-16 h-16 border rounded overflow-hidden">
                    <img src="${src}" alt="Preview" class="w-full h-full object-cover gallery-image-preview">
                </div>` : '';
                
                item.innerHTML = `
                    <div class="flex-1 grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Image URL</label>
                            <div class="flex gap-1 items-center lfm-url-field">
                                <input type="text" value="${src}" class="flex-1 border rounded px-2 py-1 text-xs gallery-image-src" placeholder="/path/to/image.jpg">
                                <button type="button" class="js-lfm-pick-image shrink-0 text-[10px] font-semibold text-[#0075de] px-1.5 py-0.5 border border-[#0075de]/30 rounded">Lib</button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Alt Text</label>
                            <input type="text" value="${alt}" class="w-full border rounded px-2 py-1 text-xs gallery-image-alt" placeholder="Alt text">
                        </div>
                    </div>
                    ${previewHtml}
                    <button type="button" class="text-red-600 hover:text-red-800 gallery-remove-image-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                
                // Wire inputs
                const srcInput = item.querySelector('.gallery-image-src');
                const altInput = item.querySelector('.gallery-image-alt');
                const previewImg = item.querySelector('.gallery-image-preview');
                
                srcInput.addEventListener('input', () => {
                    updateGalleryContent();
                    // Update preview
                    if(previewImg){
                        previewImg.src = srcInput.value;
                        if(srcInput.value && !previewImg.parentElement){
                            const previewDiv = document.createElement('div');
                            previewDiv.className = 'w-16 h-16 border rounded overflow-hidden';
                            previewDiv.appendChild(previewImg);
                            item.insertBefore(previewDiv, item.querySelector('.gallery-remove-image-btn'));
                        }
                    }
                });
                
                altInput.addEventListener('input', updateGalleryContent);
                
                // Remove button
                const removeBtn = item.querySelector('.gallery-remove-image-btn');
                removeBtn.addEventListener('click', () => {
                    item.remove();
                    updateGalleryContent();
                });
                
                imagesList.appendChild(item);
                updateGalleryContent();
            }

            // Add image button
            if(addImageBtn){
                addImageBtn.addEventListener('click', () => {
                    addGalleryImageItem('', '');
                });
            }

            // Wire existing image items
            const existingImageItems = imagesList.querySelectorAll('.gallery-image-item');
            existingImageItems.forEach(item => {
                const srcInput = item.querySelector('.gallery-image-src');
                const altInput = item.querySelector('.gallery-image-alt');
                const removeBtn = item.querySelector('.gallery-remove-image-btn');
                
                if(srcInput) srcInput.addEventListener('input', updateGalleryContent);
                if(altInput) altInput.addEventListener('input', updateGalleryContent);
                if(removeBtn){
                    removeBtn.addEventListener('click', () => {
                        item.remove();
                        updateGalleryContent();
                    });
                }
            });

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateGalleryContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'code'){
            const contentInput = form.querySelector('input.code-content-input[type="hidden"]');
            if(!contentInput) {
                console.log('Code block form handler: contentInput not found');
                return;
            }

            // Note: setupCodeEditor already handles the click preview toggling
            // This section only handles form submission and real-time updates
            const codeTextarea = form.querySelector('textarea.code-content-input');
            
            if(!codeTextarea) {
                console.log('Code block form handler: textarea not found');
                return;
            }

            function updateCodeContent(){
                try {
                    const code = codeTextarea ? codeTextarea.value : '';
                    const newContent = {
                        code: code
                    };
                    
                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    refreshAllPreviews();
                } catch(e){
                    console.error('Error updating code content:', e);
                }
            }

            // Wire textarea input for real-time updates
            if(codeTextarea){
                codeTextarea.addEventListener('input', updateCodeContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateCodeContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'map'){
            const contentInput = form.querySelector('.map-content-input');
            if(!contentInput) return;

            const addressInput = form.querySelector('.map-address-input');
            const latInput = form.querySelector('.map-latitude-input');
            const lngInput = form.querySelector('.map-longitude-input');
            const zoomSlider = form.querySelector('.map-zoom-slider');

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const editForm = li.querySelector('.block-edit-form');
                if(!editForm) return;
                
                const isHidden = editForm.classList.contains('hidden');
                if(isHidden){
                    editForm.classList.remove('hidden');
                    editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                    preview.classList.add('hidden');
                    preview.style.cssText += '; display: none !important;';
                } else {
                    editForm.classList.add('hidden');
                    editForm.style.cssText += '; display: none !important;';
                    preview.classList.remove('hidden');
                    preview.style.cssText += '; display: block !important;';
                }
            });

            function updateMapContent(){
                try {
                    const lat = parseFloat(latInput?.value || 34.0522);
                    const lng = parseFloat(lngInput?.value || -118.2437);
                    const zoom = parseInt(zoomSlider?.value || 12);
                    const address = addressInput?.value || '';
                    
                    const newContent = {
                        latitude: lat,
                        longitude: lng,
                        zoom: zoom,
                        address: address
                    };
                    
                    const contentJson = JSON.stringify(newContent);
                    contentInput.value = contentJson;
                    preview.setAttribute('data-content', contentJson);
                    
                    // Immediately refresh this preview to show updated content
                    const previewContainer = preview.querySelector('.block-preview-content');
                    if(previewContainer) {
                        const type = preview.getAttribute('data-type') || 'map';
                        const c = newContent;
                        const lat = c.latitude || 34.0522;
                        const lng = c.longitude || -118.2437;
                        const zoom = c.zoom || 12;
                        const address = c.address || '';
                        
                        previewContainer.innerHTML = `<div class="border rounded bg-gray-100 relative" style="height: 300px;">
                            <div class="absolute inset-0 flex items-center justify-center bg-gray-200 border-2 border-dashed border-gray-400">
                                <div class="text-center p-4">
                                    <i class="fas fa-map-marker-alt text-3xl text-gray-500 mb-2"></i>
                                    <p class="text-sm font-medium text-gray-700">${address || 'Map Location'}</p>
                                    <p class="text-xs text-gray-500 mt-1">Lat: ${lat}, Lng: ${lng}</p>
                                    <p class="text-xs text-gray-500">Zoom: ${zoom}</p>
                                </div>
                            </div>
                            ${address ? `<div class="absolute bottom-2 left-2 bg-white px-2 py-1 rounded text-xs shadow">${address}</div>` : ''}
                        </div>`;
                    }
                    
                    // Also refresh all previews globally
                    refreshAllPreviews();
                } catch(e){
                    console.error('Error updating map content:', e);
                }
            }

            // Update zoom display when slider changes
            const zoomDisplay = form.querySelector('.map-zoom-display');
            if(zoomSlider && zoomDisplay) {
                zoomSlider.addEventListener('input', function(){
                    zoomDisplay.textContent = this.value;
                    updateMapContent();
                });
            }

            // Wire all inputs
            if(addressInput){
                addressInput.addEventListener('input', updateMapContent);
            }
            if(latInput){
                latInput.addEventListener('input', updateMapContent);
            }
            if(lngInput){
                lngInput.addEventListener('input', updateMapContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateMapContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'testimonial'){
            const contentInput = form.querySelector('.testimonial-content-input');
            if(!contentInput) return;

            const quoteInput = form.querySelector('.testimonial-quote-input');
            const authorInput = form.querySelector('.testimonial-author-input');
            const sourceInput = form.querySelector('.testimonial-source-input');
            const imageInput = form.querySelector('.testimonial-image-input');

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const editForm = li.querySelector('.block-edit-form');
                if(!editForm) return;
                
                const isHidden = editForm.classList.contains('hidden');
                if(isHidden){
                    editForm.classList.remove('hidden');
                    editForm.style.cssText += '; display: block !important; visibility: visible !important;';
                    preview.classList.add('hidden');
                    preview.style.cssText += '; display: none !important;';
                } else {
                    editForm.classList.add('hidden');
                    editForm.style.cssText += '; display: none !important;';
                    preview.classList.remove('hidden');
                    preview.style.cssText += '; display: block !important;';
                }
            });

            function updateTestimonialContent(){
                try {
                    const quote = quoteInput?.value || '';
                    const author = authorInput?.value || '';
                    const source = sourceInput?.value || '';
                    const image = imageInput?.value || '';
                    
                    const newContent = {
                        quote: quote,
                        author: author,
                        source: source,
                        image: image
                    };
                    
                    const contentJson = JSON.stringify(newContent);
                    contentInput.value = contentJson;
                    preview.setAttribute('data-content', contentJson);
                    
                    // Immediately refresh this preview to show updated content
                    const previewContainer = preview.querySelector('.block-preview-content');
                    if(previewContainer) {
                        const quote = newContent.quote || 'Great service!';
                        const author = newContent.author || 'Jane Doe';
                        const source = newContent.source || 'Company X';
                        const image = newContent.image || '';
                        
                        // Helper function to resolve image URL
                        function resolveImageUrl(src) {
                            if(!src || src.trim() === '') return null;
                            if(src.startsWith('data:')) return src; // Base64 data URL
                            if(src.startsWith('http://') || src.startsWith('https://')) return src; // Absolute URL
                            if(src.startsWith('/')) return src; // Relative path
                            return '/storage/' + src; // Storage path
                        }
                        
                        const imgUrl = resolveImageUrl(image);
                        
                        previewContainer.innerHTML = `<div class="border rounded bg-white p-6 shadow-sm">
                            <div class="flex items-start space-x-4">
                                ${imgUrl ? `<img src="${imgUrl}" alt="${author}" class="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0" onerror="this.style.display='none'; this.nextElementSibling?.classList.remove('hidden');">
                                    <div class="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-200 flex-shrink-0 hidden flex items-center justify-center"><i class="fas fa-user  text-gray-400 text-xl"></i></div>` : `<div class="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-200 flex-shrink-0 flex items-center justify-center"><i class="fas fa-user  text-gray-400 text-xl"></i></div>`}
                                <div class="flex-1">
                                    <div class="mb-3">
                                        <svg class="w-8 h-8 text-blue-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-3.312.817-5.546 3.133-5.546 6.688 0 3.41 2.364 5.985 5.546 6.688v7.391h-10zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-3.312.817-5.546 3.133-5.546 6.688 0 3.41 2.361 5.985 5.546 6.688v7.391h-10z"/>
                                        </svg>
                                        <p class="text-gray-700 italic text-base leading-relaxed">"${quote}"</p>
                                    </div>
                                    <div class="border-t pt-3">
                                        <p class="font-semibold text-gray-900">${author}</p>
                                        ${source ? `<p class="text-sm text-gray-600">${source}</p>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    }
                    
                    // Also refresh all previews globally
                    refreshAllPreviews();
                } catch(e){
                    console.error('Error updating testimonial content:', e);
                }
            }

            // Wire all inputs
            if(quoteInput){
                quoteInput.addEventListener('input', updateTestimonialContent);
            }
            if(authorInput){
                authorInput.addEventListener('input', updateTestimonialContent);
            }
            if(sourceInput){
                sourceInput.addEventListener('input', updateTestimonialContent);
            }
            if(imageInput){
                imageInput.addEventListener('input', updateTestimonialContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateTestimonialContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && preview.getAttribute('data-type') === 'hero_section'){
            // Hero section editor is set up via setupHeroSectionEditor function
            // No need to duplicate the setup code here
            return;
        } else if(preview && preview.getAttribute('data-type') === 'heading'){
            const contentInput = form.querySelector('.heading-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const textInput = form.querySelector('.heading-text-input');
            const levelSelect = form.querySelector('.heading-level-select');
            const alignmentSelect = form.querySelector('.heading-alignment-select');
            const fontColorInput = form.querySelector('.heading-font-color-input');
            const fontColorText = form.querySelector('.heading-font-color-text');
            const backgroundTypeSelect = form.querySelector('.heading-background-type-select');
            const backgroundColorInput = form.querySelector('.heading-background-color-input');
            const backgroundColorText = form.querySelector('.heading-background-color-text');
            const backgroundImageInput = form.querySelector('.heading-background-image-input');
            const heightInput = form.querySelector('.heading-height-input');
            const bgColorContainer = form.querySelector('.heading-background-color-container');
            const bgImageContainer = form.querySelector('.heading-background-image-container');

            function updateHeadingContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    const backgroundType = backgroundTypeSelect ? backgroundTypeSelect.value : (currentContent.backgroundType || 'none');
                    
                    const newContent = {
                        text: textInput ? textInput.value : (currentContent.text || 'Your Heading Text'),
                        level: levelSelect ? levelSelect.value : (currentContent.level || 'h2'),
                        alignment: alignmentSelect ? alignmentSelect.value : (currentContent.alignment || 'left'),
                        fontColor: fontColorInput ? fontColorInput.value : (currentContent.fontColor || '#000000'),
                        backgroundType: backgroundType,
                        backgroundColor: (backgroundType === 'color' && backgroundColorInput) ? backgroundColorInput.value : (backgroundType === 'color' ? (currentContent.backgroundColor || '') : ''),
                        backgroundImage: (backgroundType === 'image' && backgroundImageInput) ? backgroundImageInput.value : (backgroundType === 'image' ? (currentContent.backgroundImage || '') : ''),
                        height: heightInput ? heightInput.value : (currentContent.height || 'auto')
                    };

                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    refreshAllPreviews();
                } catch(e){}
            }

            // Wire inputs
            if(textInput){
                textInput.addEventListener('input', updateHeadingContent);
            }
            if(levelSelect){
                levelSelect.addEventListener('change', updateHeadingContent);
            }
            if(alignmentSelect){
                alignmentSelect.addEventListener('change', updateHeadingContent);
            }
            
            // Wire font color inputs
            if(fontColorInput && fontColorText){
                fontColorInput.addEventListener('input', () => {
                    fontColorText.value = fontColorInput.value;
                    updateHeadingContent();
                });
                fontColorText.addEventListener('input', () => {
                    if(/^#[0-9A-F]{6}$/i.test(fontColorText.value)){
                        fontColorInput.value = fontColorText.value;
                        updateHeadingContent();
                    }
                });
            }
            
            // Wire background type select
            if(backgroundTypeSelect){
                backgroundTypeSelect.addEventListener('change', () => {
                    const bgType = backgroundTypeSelect.value;
                    if(bgColorContainer){
                        bgColorContainer.style.display = bgType === 'color' ? 'block' : 'none';
                    }
                    if(bgImageContainer){
                        bgImageContainer.style.display = bgType === 'image' ? 'block' : 'none';
                    }
                    updateHeadingContent();
                });
            }
            
            // Wire background color inputs
            if(backgroundColorInput && backgroundColorText){
                backgroundColorInput.addEventListener('input', () => {
                    backgroundColorText.value = backgroundColorInput.value;
                    updateHeadingContent();
                });
                backgroundColorText.addEventListener('input', () => {
                    if(/^#[0-9A-F]{6}$/i.test(backgroundColorText.value)){
                        backgroundColorInput.value = backgroundColorText.value;
                        updateHeadingContent();
                    }
                });
            }
            
            // Wire background image input
            if(backgroundImageInput){
                backgroundImageInput.addEventListener('input', updateHeadingContent);
            }
            
            // Wire height input
            if(heightInput){
                heightInput.addEventListener('input', updateHeadingContent);
            }

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateHeadingContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        } else if(preview && (preview.getAttribute('data-type') === 'two_column' || preview.getAttribute('data-type') === 'three_column')){
            const contentInput = form.querySelector('.column-content-input');
            if(!contentInput) return;

            // Click preview to toggle editor
            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = form.classList.contains('hidden');
                if(isHidden){
                    form.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    form.classList.add('hidden');
                    preview.classList.remove('hidden');
                }
            });

            // Wire editor controls
            const addBlockBtns = form.querySelectorAll('.column-add-block-btn');
            const removeBlockBtns = form.querySelectorAll('.nested-block-remove-btn');

            function updateColumnContent(){
                try {
                    const currentContent = JSON.parse(contentInput.value || '{}');
                    const columns = currentContent.columns || [];
                    const newContent = { columns: columns };
                    contentInput.value = JSON.stringify(newContent);
                    preview.setAttribute('data-content', JSON.stringify(newContent));
                    
                    // Ensure edit form stays visible when updating content (don't switch to preview mode)
                    const isEditFormVisible = !form.classList.contains('hidden') && window.getComputedStyle(form).display !== 'none';
                    if(isEditFormVisible){
                        form.classList.remove('hidden');
                        form.style.display = 'block';
                        form.style.visibility = 'visible';
                        form.style.cssText = form.style.cssText.replace(/display:\s*none[^;]*;?/gi, '');
                        form.style.cssText += '; display: block !important; visibility: visible !important;';
                        preview.classList.add('hidden');
                        preview.style.cssText += '; display: none !important;';
                    }
                    
                    refreshAllPreviews();
                    
                    // Ensure edit form stays visible after refreshAllPreviews (in case it was closed)
                    if(isEditFormVisible){
                        form.classList.remove('hidden');
                        form.style.display = 'block';
                        form.style.visibility = 'visible';
                        form.style.cssText = form.style.cssText.replace(/display:\s*none[^;]*;?/gi, '');
                        form.style.cssText += '; display: block !important; visibility: visible !important;';
                        preview.classList.add('hidden');
                        preview.style.cssText += '; display: none !important;';
                    }
                } catch(e){
                    console.error('Error updating column content:', e);
                }
            }

            // Wire add block buttons
            addBlockBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const colIdx = parseInt(this.getAttribute('data-column-index'));
                    
                    // Open the add block modal and store column context
                    const modal = document.getElementById('add-block-modal');
                    if(modal){
                        const li = form.closest('li');
                        const blockId = li?.getAttribute('data-block-id') || '';
                        const liId = li?.id || li?.getAttribute('data-temp-id') || '';
                        modal.classList.remove('hidden');
                        modal.classList.add('flex');
                        modal.setAttribute('data-column-context', JSON.stringify({
                            blockId: blockId,
                            liId: liId,
                            columnIndex: colIdx
                        }));
                        openModal(); // Use openModal to handle visibility and button hiding
                    }
                });
            });

            // Wire edit block buttons
            const editBlockBtns = form.querySelectorAll('.nested-block-edit-btn');
            console.log('Found edit buttons for existing blocks:', editBlockBtns.length);
            editBlockBtns.forEach((btn, idx) => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const colIdx = parseInt(this.getAttribute('data-column-index'));
                    const blockIdx = parseInt(this.getAttribute('data-block-index'));
                    
                    console.log('Edit button clicked (existing block):', {colIdx, blockIdx, btn: this});
                    
                    // Get block data
                    const blocksList = form.querySelector(`.column-blocks-list[data-column-index="${colIdx}"]`);
                    const blockItem = blocksList?.querySelector(`.nested-block-item:nth-child(${blockIdx + 1})`);
                    
                    console.log('Block item found:', {blockItem, blocksList});
                    
                    if(blockItem){
                        let blockType = blockItem.getAttribute('data-block-type');
                        let blockContent = {};
                        
                        // Try to get content from data attribute first
                        const contentAttr = blockItem.getAttribute('data-block-content');
                        if(contentAttr){
                            try {
                                blockContent = JSON.parse(contentAttr.replace(/&#39;/g, "'"));
                            } catch(e){
                                console.error('Error parsing content from attribute:', e);
                            }
                        }
                        
                        // If not found, get from content input
                        if(Object.keys(blockContent).length === 0 || !blockType || blockType === 'unknown'){
                            try {
                                const currentContent = JSON.parse(contentInput.value || '{}');
                                const columns = currentContent.columns || [];
                                if(columns[colIdx] && columns[colIdx].blocks && columns[colIdx].blocks[blockIdx]){
                                    blockContent = columns[colIdx].blocks[blockIdx].content || {};
                                    blockType = columns[colIdx].blocks[blockIdx].type || blockType || 'richtext';
                                }
                            } catch(e){
                                console.error('Error getting block data:', e);
                            }
                        }
                        
                        console.log('Opening edit modal:', {blockType, blockContent, colIdx, blockIdx});
                        
                        // Open edit modal
                        const li = form.closest('li');
                        if(openNestedBlockEditModal){
                            openNestedBlockEditModal(blockType, blockContent, colIdx, blockIdx, li);
                        } else {
                            console.error('openNestedBlockEditModal function not found!');
                        }
                    } else {
                        console.error('Could not find blockItem:', {blocksList, blockIdx, colIdx, form});
                    }
                });
            });
            
            // Wire remove block buttons
            removeBlockBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const colIdx = parseInt(this.getAttribute('data-column-index'));
                    const blockIdx = parseInt(this.getAttribute('data-block-index'));
                    
                    // Update content
                    try {
                        const currentContent = JSON.parse(contentInput.value || '{}');
                        const columns = currentContent.columns || [];
                        if(columns[colIdx] && columns[colIdx].blocks){
                            columns[colIdx].blocks.splice(blockIdx, 1);
                            contentInput.value = JSON.stringify({columns: columns});
                            preview.setAttribute('data-content', contentInput.value);
                            refreshAllPreviews();
                            
                            // Remove from DOM
                            const blocksList = form.querySelector(`.column-blocks-list[data-column-index="${colIdx}"]`);
                            const blockItem = blocksList?.querySelector(`.nested-block-item:nth-child(${blockIdx + 1})`);
                            if(blockItem) blockItem.remove();
                            
                            // Show empty message if no blocks
                            if(blocksList && blocksList.children.length === 0){
                                blocksList.innerHTML = '<div class="text-xs text-gray-400 text-center py-4">No blocks yet</div>';
                            }
                        }
                    } catch(e){
                        console.error('Error removing block from column:', e);
                    }
                });
            });

            // Update content before form submission
            form.addEventListener('submit', (e) => {
                updateColumnContent();
                // Update the hidden content input in the form
                const hiddenContentInput = form.querySelector('input[name="content"]');
                if(hiddenContentInput && contentInput){
                    hiddenContentInput.value = contentInput.value;
                }
            });
        }
    });

    // Update preview on content edits
    document.querySelectorAll('textarea.block-content-input').forEach(ta => {
        ta.addEventListener('input', () => { refreshAllPreviews(); });
    });
    
    // ==========================================
    // DELETE BUTTON HANDLING (UI-only removal)
    // ==========================================
    // Track deleted block IDs so they can be removed from database on save
    // Make it globally accessible for the save function
    window.deletedBlockIds = new Set();
    
    // Handle delete button clicks - just remove from UI, don't call route
    document.addEventListener('click', function(e) {
        const deleteBtn = e.target.closest('.block-delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const li = deleteBtn.closest('li[data-block-id]');
            if (li) {
                const blockId = li.getAttribute('data-block-id');
                // Prevent deletion of locked blocks
                if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Block is Locked',
                        text: 'Cannot delete a locked block. Unlock it first.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    return;
                }
            }
            
            // Save state before deletion for undo/redo
            HistoryManager.saveState();
            
            if (li) {
                const blockId = li.getAttribute('data-block-id');
                if (blockId) {
                    // Track this block ID for deletion when save is clicked
                    window.deletedBlockIds.add(parseInt(blockId));
                }
                
                // Remove from DOM
                li.remove();
                updateOrders(false);
                updateEmptyMessage();
                
                // Save state after deletion for undo/redo
                HistoryManager.saveState();
            }
        }
    });
    
    // ==========================================
    // DEBOUNCED HISTORY TRACKING FOR PROPERTY CHANGES
    // ==========================================
    let propertyChangeTimeout = null;
    let hasUnsavedPropertyChanges = false;
    
    // Function to schedule history save for property changes
    function schedulePropertyChangeSave() {
        if (propertyChangeTimeout) {
            clearTimeout(propertyChangeTimeout);
        }
        
        if (!hasUnsavedPropertyChanges) {
            hasUnsavedPropertyChanges = true;
            // Save initial state before first change
            HistoryManager.saveState();
        }
        
        // Debounce: save after 1 second of no changes
        propertyChangeTimeout = setTimeout(() => {
            if (hasUnsavedPropertyChanges) {
                HistoryManager.saveState();
                hasUnsavedPropertyChanges = false;
            }
            propertyChangeTimeout = null;
        }, 1000);
    }
    
    // Track property changes in all update functions
    // We'll wrap the update functions to add history tracking
    const originalUpdateFunctions = {
        updateHeadingContent: null,
        updateRichTextContent: null,
        updateImageContent: null,
        updateButtonContent: null,
        updateDividerContent: null,
        updateSpacerContent: null,
        updateVideoContent: null,
        updateGalleryContent: null,
        updateMapContent: null,
        updateTestimonialContent: null,
        updateCodeContent: null,
        updateHeroContent: null,
        updateColumnContent: null
    };
    
    // Override update functions to include history tracking
    // This is done by wrapping the function calls in setup functions
    // We'll modify the setup functions to wrap their update functions
    
    // Helper to wrap update functions with history tracking
    function wrapUpdateFunction(updateFn, originalFn) {
        if (typeof updateFn !== 'function') return originalFn;
        return function(...args) {
            const result = originalFn.apply(this, args);
            if (!HistoryManager.isExecuting) {
                schedulePropertyChangeSave();
            }
            return result;
        };
    }
    
    // We'll add history tracking by modifying the setup functions
    // For now, we'll add a MutationObserver to watch for content changes
    // This is a simpler approach that catches all changes
    observer = new MutationObserver((mutations) => {
        if (HistoryManager.isExecuting) return;
        
        // Check if any meaningful changes occurred
        let hasRelevantChanges = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                // Watch for content changes in preview elements or content inputs
                if (target.hasAttribute('data-content') || 
                    target.classList.contains('block-preview') ||
                    (target.tagName === 'INPUT' && target.name && target.name.includes('content')) ||
                    (target.tagName === 'TEXTAREA' && target.name && target.name.includes('content'))) {
                    hasRelevantChanges = true;
                }
            } else if (mutation.type === 'childList') {
                // Watch for new blocks being added (but not during restore)
                if (!HistoryManager.isExecuting && mutation.addedNodes.length > 0) {
                    const addedNode = mutation.addedNodes[0];
                    if (addedNode.nodeType === 1 && (addedNode.hasAttribute('data-block-id') || addedNode.hasAttribute('data-temp-id'))) {
                        // This is handled by explicit saveState calls
                        return;
                    }
                }
            }
        });
        
        if (hasRelevantChanges && !HistoryManager.isExecuting) {
            schedulePropertyChangeSave();
        }
    });
    
    // Observe the blocks list for changes
    if (list) {
        observer.observe(list, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-content', 'data-width']
        });
    }
    
    // ==========================================
    // FEATURE 6: BLOCK VISIBILITY TOGGLE
    // ==========================================
    function toggleBlockVisibility(li, forceState = null) {
        const content = li.querySelector('.block-edit-form, .block-preview');
        const toggleBtn = li.querySelector('.block-toggle-visibility-btn');
        const icon = toggleBtn?.querySelector('i');
        
        if (!content || !toggleBtn) return;
        
        const isCollapsed = li.classList.contains('block-collapsed');
        const shouldCollapse = forceState !== null ? !forceState : !isCollapsed;
        
        if (shouldCollapse) {
            li.classList.add('block-collapsed');
            content.style.display = 'none';
            if (icon) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        } else {
            li.classList.remove('block-collapsed');
            content.style.display = '';
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        }
    }
    
    // Toggle visibility button handlers
    document.addEventListener('click', function(e) {
        const toggleBtn = e.target.closest('.block-toggle-visibility-btn');
        if (toggleBtn) {
            e.preventDefault();
            e.stopPropagation();
            const li = toggleBtn.closest('li');
            if (li) {
                toggleBlockVisibility(li);
            }
        }
        
        // Expand All
        if (e.target.closest('#expand-all-blocks-btn')) {
            e.preventDefault();
            list.querySelectorAll('li[data-block-id], li[data-temp-id]').forEach(li => {
                toggleBlockVisibility(li, false); // false = expand
            });
        }
        
        // Collapse All
        if (e.target.closest('#collapse-all-blocks-btn')) {
            e.preventDefault();
            list.querySelectorAll('li[data-block-id], li[data-temp-id]').forEach(li => {
                toggleBlockVisibility(li, true); // true = collapse
            });
        }
    });
    
    // ==========================================
    // FEATURE 7: BLOCK SEARCH/FILTER
    // ==========================================
    const searchInput = document.getElementById('block-search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    
    function filterBlocks(searchTerm) {
        if (!list) return;
        
        const blocks = list.querySelectorAll('li[data-block-id], li[data-temp-id]');
        const term = searchTerm.toLowerCase().trim();
        let matchCount = 0;
        
        blocks.forEach(li => {
            const blockType = li.querySelector('.block-preview')?.getAttribute('data-type') || '';
            const blockLabel = li.querySelector('span.text-sm.font-medium')?.textContent || '';
            const blockNote = li.getAttribute('data-note') || '';
            
            const matches = 
                blockType.toLowerCase().includes(term) ||
                blockLabel.toLowerCase().includes(term) ||
                blockNote.toLowerCase().includes(term);
            
            if (matches || !term) {
                li.style.display = '';
                matchCount++;
            } else {
                li.style.display = 'none';
            }
        });
        
        // Update clear button visibility
        if (clearSearchBtn) {
            clearSearchBtn.classList.toggle('hidden', !term);
        }
        
        // Show result count
        const searchContainer = searchInput?.parentElement;
        if (searchContainer && term) {
            let resultCount = searchContainer.querySelector('.search-result-count');
            if (!resultCount) {
                resultCount = document.createElement('span');
                resultCount.className = 'search-result-count text-xs text-gray-500 ml-2';
                searchContainer.appendChild(resultCount);
            }
            resultCount.textContent = `${matchCount} found`;
        } else {
            const resultCount = searchContainer?.querySelector('.search-result-count');
            if (resultCount) resultCount.remove();
        }
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterBlocks(this.value);
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (searchInput) {
                searchInput.value = '';
                filterBlocks('');
                searchInput.focus();
            }
        });
    }
    
    // ==========================================
    // FEATURE 8: BULK OPERATIONS
    // ==========================================
    const selectAllBtn = document.getElementById('select-all-blocks-btn');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const bulkDuplicateBtn = document.getElementById('bulk-duplicate-btn');
    const copyBlockBtn = document.getElementById('copy-block-btn');
    
    function updateBulkActionButtons() {
        const selectedBlocks = list?.querySelectorAll('li.block-selected') || [];
        const count = selectedBlocks.length;
        
        // Get buttons dynamically to avoid initialization order issues
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        const bulkDuplicateBtn = document.getElementById('bulk-duplicate-btn');
        const copyBlockBtn = document.getElementById('copy-block-btn');
        const bulkLockBtn = document.getElementById('bulk-lock-btn');
        
        if (bulkDeleteBtn) bulkDeleteBtn.disabled = count === 0;
        if (bulkDuplicateBtn) bulkDuplicateBtn.disabled = count === 0;
        if (copyBlockBtn) copyBlockBtn.disabled = count !== 1; // Copy works with single selection
        
        // Update bulk lock button state and icon
        if (bulkLockBtn && typeof BlockLockManager !== 'undefined' && BlockLockManager) {
            bulkLockBtn.disabled = count === 0;
            
            if (count > 0) {
                // Check if all selected blocks are locked
                const allLocked = Array.from(selectedBlocks).every(li => {
                    const blockId = li.getAttribute('data-block-id');
                    const tempId = li.getAttribute('data-temp-id');
                    const id = blockId || tempId;
                    return id && BlockLockManager.isLocked(id);
                });
                
                // Check if all selected blocks are unlocked
                const allUnlocked = Array.from(selectedBlocks).every(li => {
                    const blockId = li.getAttribute('data-block-id');
                    const tempId = li.getAttribute('data-temp-id');
                    const id = blockId || tempId;
                    return !id || !BlockLockManager.isLocked(id);
                });
                
                // Update button icon and title
                const icon = bulkLockBtn.querySelector('i');
                if (allLocked) {
                    // All are locked, show unlock icon
                    if (icon) {
                        icon.className = 'fas fa-unlock text-xs';
                    }
                    bulkLockBtn.title = 'Unlock Selected Blocks';
                } else if (allUnlocked) {
                    // All are unlocked, show lock icon
                    if (icon) {
                        icon.className = 'fas fa-lock text-xs';
                    }
                    bulkLockBtn.title = 'Lock Selected Blocks';
                } else {
                    // Mixed state, show lock icon (will lock all)
                    if (icon) {
                        icon.className = 'fas fa-lock text-xs';
                    }
                    bulkLockBtn.title = 'Lock Selected Blocks';
                }
            }
        } else if (bulkLockBtn) {
            bulkLockBtn.disabled = count === 0;
        }
    }
    
    function toggleBlockSelection(li, forceState = null) {
        const blockId = li.getAttribute('data-block-id');
        
        // Prevent selection of locked blocks
        if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
            // Uncheck if already selected
            const checkbox = li.querySelector('.block-select-checkbox');
            if (checkbox) checkbox.checked = false;
            li.classList.remove('block-selected');
            updateBulkActionButtons();
            return;
        }
        
        const checkbox = li.querySelector('.block-select-checkbox');
        let shouldSelect;
        
        if (forceState !== null) {
            // Force state (used by Select All)
            shouldSelect = forceState;
        } else if (checkbox) {
            // Use checkbox state
            shouldSelect = checkbox.checked;
        } else {
            // Fallback: toggle based on class
            shouldSelect = !li.classList.contains('block-selected');
        }
        
        if (shouldSelect) {
            li.classList.add('block-selected');
            if (checkbox) checkbox.checked = true;
        } else {
            li.classList.remove('block-selected');
            if (checkbox) checkbox.checked = false;
        }
        
        updateBulkActionButtons();
    }
    
    // Checkbox handler
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('block-select-checkbox')) {
            e.stopPropagation();
            const li = e.target.closest('li[data-block-id], li[data-temp-id]');
            if (li) {
                const blockId = li.getAttribute('data-block-id');
                
                // Prevent selection of locked blocks
                if (blockId && (typeof BlockLockManager !== 'undefined') && BlockLockManager && BlockLockManager.isLocked(blockId)) {
                    e.target.checked = false;
                    li.classList.remove('block-selected');
                    updateBulkActionButtons();
                    return;
                }
                
                toggleBlockSelection(li);
            }
        }
    });
    
    // Select All button
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            const blocks = list.querySelectorAll('li[data-block-id], li[data-temp-id]');
            // Filter out locked blocks for selection
            const selectableBlocks = Array.from(blocks).filter(li => {
                const blockId = li.getAttribute('data-block-id');
                return !blockId || !(typeof BlockLockManager !== 'undefined') || !BlockLockManager || !BlockLockManager.isLocked(blockId);
            });
            const allSelected = selectableBlocks.length > 0 && Array.from(selectableBlocks).every(li => li.classList.contains('block-selected'));
            
            selectableBlocks.forEach(li => {
                toggleBlockSelection(li, !allSelected);
            });
        });
    }
    
    // Bulk Delete
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', function() {
            const selectedBlocks = list.querySelectorAll('li.block-selected');
            // Filter out locked blocks from deletion
            const deletableBlocks = Array.from(selectedBlocks).filter(li => {
                const blockId = li.getAttribute('data-block-id');
                return !blockId || !(typeof BlockLockManager !== 'undefined') || !BlockLockManager || !BlockLockManager.isLocked(blockId);
            });
            
            if (deletableBlocks.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No Deletable Blocks',
                    text: 'All selected blocks are locked and cannot be deleted. Unlock them first.',
                    timer: 2000,
                    showConfirmButton: false
                });
                return;
            }
            
            if (deletableBlocks.length < selectedBlocks.length) {
                Swal.fire({
                    icon: 'info',
                    title: 'Some Blocks Are Locked',
                    text: `${selectedBlocks.length - deletableBlocks.length} locked block(s) will be skipped. Delete ${deletableBlocks.length} block(s)?`,
                    showCancelButton: true,
                    confirmButtonText: 'Delete',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed) {
                        deleteSelectedBlocks(deletableBlocks);
                    }
                });
            } else if (deletableBlocks.length > 0) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Delete Blocks',
                        text: `Delete ${deletableBlocks.length} block(s)?`,
                        showCancelButton: true,
                        confirmButtonText: 'Delete',
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#dc2626'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            deleteSelectedBlocks(deletableBlocks);
                        }
                    });
                } else {
                    // Fallback to native confirm if SweetAlert2 hasn't loaded yet
                    if (confirm(`Delete ${deletableBlocks.length} block(s)?`)) {
                        deleteSelectedBlocks(deletableBlocks);
                    }
                }
            }
        });
    }
    
    function deleteSelectedBlocks(blocks) {
        HistoryManager.saveState();
        blocks.forEach(li => {
            const blockId = li.getAttribute('data-block-id');
            if (blockId) {
                window.deletedBlockIds.add(parseInt(blockId));
            }
            li.remove();
        });
        updateOrders(false);
        updateEmptyMessage();
        updateBulkActionButtons();
        HistoryManager.saveState();
    }
    
    // Bulk Duplicate
    if (bulkDuplicateBtn) {
        bulkDuplicateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const selectedBlocks = Array.from(list.querySelectorAll('li.block-selected'));
            // Filter out locked blocks from duplication
            const duplicatableBlocks = selectedBlocks.filter(li => {
                const blockId = li.getAttribute('data-block-id');
                return !blockId || !(typeof BlockLockManager !== 'undefined') || !BlockLockManager || !BlockLockManager.isLocked(blockId);
            });
            
            if (duplicatableBlocks.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No Duplicatable Blocks',
                    text: 'All selected blocks are locked and cannot be duplicated. Unlock them first.',
                    timer: 2000,
                    showConfirmButton: false
                });
                return;
            }
            
            if (duplicatableBlocks.length > 0) {
                HistoryManager.saveState();
                
                // Collect blocks to duplicate first (before modifying DOM)
                const blocksToDuplicate = duplicatableBlocks.map(li => {
                    const preview = li.querySelector('.block-preview');
                    if (!preview) return null;
                    
                    const blockType = preview.getAttribute('data-type');
                    const widthInput = li.querySelector('.hidden-width-input');
                    const width = widthInput ? widthInput.value : (li.getAttribute('data-width') || 'full');
                    let content = preview.getAttribute('data-content') || '{}';
                    
                    // Try to get updated content from edit forms
                    const editForm = li.querySelector('.block-edit-form');
                    if (editForm && !editForm.classList.contains('hidden')) {
                        const contentInput = editForm.querySelector('input[name="content"], textarea.block-content-input, .divider-content-input, .spacer-content-input, .button-content-input, .video-content-input, .richtext-content-input, .image-content-input, .heading-content-input, .gallery-content-input, .code-content-input, .map-content-input, .testimonial-content-input, .hero-content-input, .column-content-input');
                        if (contentInput && contentInput.value) {
                            content = contentInput.value;
                        }
                    }
                    
                    return { blockType, content, width };
                }).filter(Boolean);
                
                // Clear selection before duplicating
                selectedBlocks.forEach(li => {
                    toggleBlockSelection(li, false);
                });
                
                // Duplicate all blocks
                blocksToDuplicate.forEach(blockData => {
                    if (typeof createTempBlockElement === 'function') {
                        const newBlock = createTempBlockElement(blockData.blockType, blockData.content, blockData.width);
                        list.appendChild(newBlock);
                        
                        // Setup editor for the new block
                        const newLi = list.lastElementChild;
                        const blockType = blockData.blockType;
                        
                        if (blockType === 'heading' && typeof setupHeadingEditor === 'function') setupHeadingEditor(newLi);
                        else if (blockType === 'image' && typeof setupImageEditor === 'function') setupImageEditor(newLi);
                        else if (blockType === 'gallery' && typeof setupGalleryEditor === 'function') setupGalleryEditor(newLi);
                        else if (blockType === 'map' && typeof setupMapEditor === 'function') setupMapEditor(newLi);
                        else if (blockType === 'testimonial' && typeof setupTestimonialEditor === 'function') setupTestimonialEditor(newLi);
                        else if (blockType === 'code' && typeof setupCodeEditor === 'function') setupCodeEditor(newLi);
                        else if (blockType === 'hero_section' && typeof setupHeroSectionEditor === 'function') setupHeroSectionEditor(newLi);
                        else if (blockType === 'richtext' && typeof setupRichTextEditor === 'function') setupRichTextEditor(newLi);
                        else if (blockType === 'spacer' && typeof setupSpacerEditor === 'function') setupSpacerEditor(newLi);
                        else if (blockType === 'button' && typeof setupButtonEditor === 'function') setupButtonEditor(newLi);
                        else if (blockType === 'video' && typeof setupVideoEditor === 'function') setupVideoEditor(newLi);
                        else if (blockType === 'divider' && typeof setupDividerEditor === 'function') setupDividerEditor(newLi);
                        else if ((blockType === 'two_column' || blockType === 'three_column') && typeof setupColumnEditor === 'function') setupColumnEditor(newLi);
                    }
                });
                
                // Update UI
                if (typeof attachDnD === 'function') attachDnD();
                if (typeof refreshAllPreviews === 'function') refreshAllPreviews();
                if (typeof updateOrders === 'function') updateOrders(false);
                if (typeof updateEmptyMessage === 'function') updateEmptyMessage();
                
                HistoryManager.saveState();
            }
        });
    }
    
    // Bulk Lock/Unlock
    const bulkLockBtn = document.getElementById('bulk-lock-btn');
    if (bulkLockBtn) {
        bulkLockBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (typeof BlockLockManager === 'undefined' || !BlockLockManager) {
                console.warn('BlockLockManager is not available');
                return;
            }
            
            const selectedBlocks = Array.from(list.querySelectorAll('li.block-selected'));
            if (selectedBlocks.length === 0) {
                return;
            }
            
            // Determine if we should lock or unlock
            const allLocked = selectedBlocks.every(li => {
                const blockId = li.getAttribute('data-block-id');
                const tempId = li.getAttribute('data-temp-id');
                const id = blockId || tempId;
                return id && BlockLockManager.isLocked(id);
            });
            
            // Lock or unlock all selected blocks
            selectedBlocks.forEach(li => {
                const blockId = li.getAttribute('data-block-id');
                const tempId = li.getAttribute('data-temp-id');
                const id = blockId || tempId;
                
                if (id) {
                    if (allLocked) {
                        BlockLockManager.unlockBlock(id);
                    } else {
                        BlockLockManager.lockBlock(id);
                    }
                }
            });
            
            // Save state and update UI
            BlockLockManager.saveLockedBlocks();
            BlockLockManager.updateAllLockStates();
            updateBulkActionButtons();
            HistoryManager.saveState();
        });
    }
    
    // ==========================================
    // FEATURE 9: BLOCK TEMPLATES / PRESETS
    // ==========================================
    const STORAGE_KEY_TEMPLATES = 'zenobuilder_block_templates';
    
    function saveBlockTemplates() {
        const templates = getBlockTemplates();
        localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
    }
    
    function getBlockTemplates() {
        const stored = localStorage.getItem(STORAGE_KEY_TEMPLATES);
        return stored ? JSON.parse(stored) : [];
    }
    
    function loadTemplate(template) {
        if (typeof createTempBlockElement === 'function') {
            const newBlock = createTempBlockElement(template.type, template.content, template.width);
            list.appendChild(newBlock);
            updateEmptyMessage();
            updateOrders(false);
            
            // Setup editor for the new block
            const blockType = template.type;
            const newLi = list.lastElementChild;
            
            if (blockType === 'heading' && typeof setupHeadingEditor === 'function') setupHeadingEditor(newLi);
            else if (blockType === 'image' && typeof setupImageEditor === 'function') setupImageEditor(newLi);
            else if (blockType === 'gallery' && typeof setupGalleryEditor === 'function') setupGalleryEditor(newLi);
            else if (blockType === 'map' && typeof setupMapEditor === 'function') setupMapEditor(newLi);
            else if (blockType === 'testimonial' && typeof setupTestimonialEditor === 'function') setupTestimonialEditor(newLi);
            else if (blockType === 'code' && typeof setupCodeEditor === 'function') setupCodeEditor(newLi);
            else if (blockType === 'hero_section' && typeof setupHeroSectionEditor === 'function') setupHeroSectionEditor(newLi);
            else if (blockType === 'richtext' && typeof setupRichTextEditor === 'function') setupRichTextEditor(newLi);
            else if (blockType === 'spacer' && typeof setupSpacerEditor === 'function') setupSpacerEditor(newLi);
            else if (blockType === 'button' && typeof setupButtonEditor === 'function') setupButtonEditor(newLi);
            else if (blockType === 'video' && typeof setupVideoEditor === 'function') setupVideoEditor(newLi);
            else if (blockType === 'divider' && typeof setupDividerEditor === 'function') setupDividerEditor(newLi);
            else if ((blockType === 'two_column' || blockType === 'three_column') && typeof setupColumnEditor === 'function') setupColumnEditor(newLi);
            
            HistoryManager.saveState();
        }
    }
    
    function renderTemplateList(searchTerm = '') {
        const templateList = document.getElementById('template-list');
        const templates = getBlockTemplates();
        const filtered = searchTerm 
            ? templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
            : templates;
        
        if (!templateList) return;
        
        if (filtered.length === 0) {
            templateList.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">No templates found</p>';
            return;
        }
        
        templateList.innerHTML = filtered.map(template => `
            <div class="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer template-item" data-template-id="${template.id}">
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-700">${escapeHtml(template.name)}</div>
                    <div class="text-xs text-gray-500">${template.type.replace('_', ' ')}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded use-template-btn" data-template-id="${template.id}">Use</button>
                    <button class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded delete-template-btn" data-template-id="${template.id}">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Attach event handlers
        templateList.querySelectorAll('.use-template-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const templateId = this.getAttribute('data-template-id');
                const template = templates.find(t => t.id === templateId);
                if (template) {
                    loadTemplate(template);
                    document.getElementById('template-dropdown')?.classList.add('hidden');
                }
            });
        });
        
        templateList.querySelectorAll('.delete-template-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const templateId = this.getAttribute('data-template-id');
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Delete Template',
                        text: 'Delete this template?',
                        showCancelButton: true,
                        confirmButtonText: 'Delete',
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#dc2626'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            const updatedTemplates = templates.filter(t => t.id !== templateId);
                            localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(updatedTemplates));
                            renderTemplateList(searchTerm);
                        }
                    });
                } else {
                    // Fallback to native confirm if SweetAlert2 hasn't loaded yet
                    if (confirm('Delete this template?')) {
                        const updatedTemplates = templates.filter(t => t.id !== templateId);
                        localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(updatedTemplates));
                        renderTemplateList(searchTerm);
                    }
                }
            });
        });
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Template dropdown
    const templateDropdownBtn = document.getElementById('template-dropdown-btn');
    const templateDropdown = document.getElementById('template-dropdown');
    const templateSearch = document.getElementById('template-search');
    
    if (templateDropdownBtn) {
        templateDropdownBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (templateDropdown) {
                templateDropdown.classList.toggle('hidden');
                if (!templateDropdown.classList.contains('hidden')) {
                    renderTemplateList();
                }
            }
        });
    }
    
    document.addEventListener('click', function(e) {
        if (e.target.closest('#template-dropdown-btn') || e.target.closest('#template-dropdown')) {
            // Let the button handler manage it
            return;
        } else if (templateDropdown && !templateDropdown.classList.contains('hidden')) {
            templateDropdown.classList.add('hidden');
        }
    });
    
    if (templateSearch) {
        templateSearch.addEventListener('input', function() {
            renderTemplateList(this.value);
        });
    }
    
    // ==========================================
    // FEATURE 10: COPY/PASTE BETWEEN PAGES
    // ==========================================
    const STORAGE_KEY_CLIPBOARD = 'zenobuilder_block_clipboard';
    
    function copyBlockToClipboard(li) {
        const preview = li.querySelector('.block-preview');
        if (!preview) return;
        
        const blockType = preview.getAttribute('data-type');
        let content = preview.getAttribute('data-content') || '{}';
        const width = li.getAttribute('data-width') || 'full';
        
        // Try to get updated content from edit forms if the form is open
        const editForm = li.querySelector('.block-edit-form');
        if (editForm && !editForm.classList.contains('hidden')) {
            // Try to get updated content from content input
            const contentInput = editForm.querySelector('input[name="content"], textarea.block-content-input');
            if (contentInput && contentInput.value) {
                content = contentInput.value;
            }
            
            // Handle special block types with custom content inputs
            const blockTypeInputs = {
                'divider': '.divider-content-input',
                'spacer': '.spacer-content-input',
                'button': '.button-content-input',
                'video': '.video-content-input',
                'richtext': '.richtext-content-input',
                'image': '.image-content-input',
                'heading': '.heading-content-input',
                'gallery': '.gallery-content-input',
                'code': '.code-content-input',
                'map': '.map-content-input',
                'testimonial': '.testimonial-content-input',
                'hero_section': '.hero-content-input',
                'two_column': '.column-content-input',
                'three_column': '.column-content-input'
            };
            
            const contentInputSelector = blockTypeInputs[blockType];
            if (contentInputSelector) {
                const blockContentInput = editForm.querySelector(contentInputSelector);
                if (blockContentInput && blockContentInput.value) {
                    content = blockContentInput.value;
                }
            }
            
            // For heading blocks, manually construct content from form fields if needed
            if (blockType === 'heading') {
                const textInput = editForm.querySelector('.heading-text-input');
                const levelSelect = editForm.querySelector('.heading-level-select');
                const alignmentSelect = editForm.querySelector('.heading-alignment-select');
                const fontColorInput = editForm.querySelector('.heading-font-color-input');
                const fontColorText = editForm.querySelector('.heading-font-color-text');
                
                if (textInput || levelSelect || alignmentSelect) {
                    try {
                        const currentContent = JSON.parse(content);
                        if (textInput) currentContent.text = textInput.value;
                        if (levelSelect) currentContent.level = levelSelect.value;
                        if (alignmentSelect) currentContent.alignment = alignmentSelect.value;
                        if (fontColorText && fontColorText.value) {
                            currentContent.fontColor = fontColorText.value;
                        } else if (fontColorInput && fontColorInput.value) {
                            currentContent.fontColor = fontColorInput.value;
                        }
                        content = JSON.stringify(currentContent);
                    } catch(e) {
                        console.warn('Error parsing heading content:', e);
                    }
                }
            }
        }
        
        const blockData = {
            type: blockType,
            content: content,
            width: width
        };
        
        localStorage.setItem(STORAGE_KEY_CLIPBOARD, JSON.stringify(blockData));
        
        if (copyBlockBtn) copyBlockBtn.disabled = false;
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Block Copied',
                text: 'Block copied to clipboard',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    }
    
    function pasteBlockFromClipboard() {
        const clipboardData = localStorage.getItem(STORAGE_KEY_CLIPBOARD);
        if (!clipboardData) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Clipboard Empty',
                    text: 'No block copied yet',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            }
            return;
        }
        
        try {
            const blockData = JSON.parse(clipboardData);
            if (typeof createTempBlockElement === 'function') {
                const newBlock = createTempBlockElement(blockData.type, blockData.content, blockData.width);
                list.appendChild(newBlock);
                updateEmptyMessage();
                updateOrders(false);
                
                // Setup editor
                const newLi = list.lastElementChild;
                const blockType = blockData.type;
                
                if (blockType === 'heading' && typeof setupHeadingEditor === 'function') setupHeadingEditor(newLi);
                else if (blockType === 'image' && typeof setupImageEditor === 'function') setupImageEditor(newLi);
                else if (blockType === 'gallery' && typeof setupGalleryEditor === 'function') setupGalleryEditor(newLi);
                else if (blockType === 'map' && typeof setupMapEditor === 'function') setupMapEditor(newLi);
                else if (blockType === 'testimonial' && typeof setupTestimonialEditor === 'function') setupTestimonialEditor(newLi);
                else if (blockType === 'code' && typeof setupCodeEditor === 'function') setupCodeEditor(newLi);
                else if (blockType === 'hero_section' && typeof setupHeroSectionEditor === 'function') setupHeroSectionEditor(newLi);
                else if (blockType === 'richtext' && typeof setupRichTextEditor === 'function') setupRichTextEditor(newLi);
                else if (blockType === 'spacer' && typeof setupSpacerEditor === 'function') setupSpacerEditor(newLi);
                else if (blockType === 'button' && typeof setupButtonEditor === 'function') setupButtonEditor(newLi);
                else if (blockType === 'video' && typeof setupVideoEditor === 'function') setupVideoEditor(newLi);
                else if (blockType === 'divider' && typeof setupDividerEditor === 'function') setupDividerEditor(newLi);
                else if ((blockType === 'two_column' || blockType === 'three_column') && typeof setupColumnEditor === 'function') setupColumnEditor(newLi);
                
                // Refresh previews after setting up editors to ensure content is displayed
                if (typeof refreshAllPreviews === 'function') {
                    setTimeout(() => {
                        refreshAllPreviews();
                    }, 100);
                }
                
                HistoryManager.saveState();
                
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Block Pasted',
                        text: 'Block pasted successfully',
                        timer: 1000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            }
        } catch (e) {
            console.error('Error pasting block:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to paste block',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            }
        }
    }
    
    // Copy button
    if (copyBlockBtn) {
        copyBlockBtn.addEventListener('click', function() {
            const selectedBlocks = list.querySelectorAll('li.block-selected');
            if (selectedBlocks.length === 1) {
                copyBlockToClipboard(selectedBlocks[0]);
            }
        });
    }
    
    // Paste button
    const pasteBlockBtn = document.getElementById('paste-block-btn');
    if (pasteBlockBtn) {
        pasteBlockBtn.addEventListener('click', function() {
            pasteBlockFromClipboard();
        });
        
        // Check clipboard on load
        const clipboardData = localStorage.getItem(STORAGE_KEY_CLIPBOARD);
        if (clipboardData) {
            pasteBlockBtn.disabled = false;
        }
    }
    
    // ==========================================
    // FEATURE 11: BLOCK NOTES/COMMENTS (Database Storage)
    // ==========================================
    
    function getBlockNote(blockId) {
        const li = list?.querySelector(`li[data-block-id="${blockId}"]`);
        if (!li) return '';
        return li.getAttribute('data-note') || '';
    }
    
    function updateBlockNoteIndicator(blockId, note = null) {
        const li = list?.querySelector(`li[data-block-id="${blockId}"]`);
        if (!li) return;
        
        // Get note from parameter or from data attribute
        const blockNote = note !== null ? note : (li.getAttribute('data-note') || '');
        
        const noteBtn = li.querySelector('.block-note-btn');
        if (noteBtn) {
            if (blockNote && blockNote.trim()) {
                noteBtn.classList.add('text-yellow-600');
                noteBtn.classList.remove('text-gray-400');
                const noteText = blockNote.trim();
                noteBtn.title = `Note: ${noteText.substring(0, 50)}${noteText.length > 50 ? '...' : ''}`;
            } else {
                noteBtn.classList.add('text-gray-400');
                noteBtn.classList.remove('text-yellow-600');
                noteBtn.title = 'Add note';
            }
        }
        
        // Update data attribute
        li.setAttribute('data-note', blockNote || '');
    }
    
    // Load existing notes for blocks from DOM (loaded from database)
    function loadBlockNotes() {
        if (!list) return;
        const blocks = list.querySelectorAll('li[data-block-id]');
        blocks.forEach(li => {
            const blockId = li.getAttribute('data-block-id');
            const note = li.getAttribute('data-note') || '';
            if (blockId) {
                updateBlockNoteIndicator(blockId, note);
            }
        });
    }
    
    // Save note via AJAX to database
    function saveBlockNoteToDatabase(blockId, note) {
        const pageSlug = window.location.pathname.match(/\/pages\/([^\/]+)\//)?.[1];
        if (!pageSlug || !blockId) {
            console.error('Page slug or block ID not found');
            return Promise.reject('Page slug or block ID not found');
        }
        
        const url = `/admin/cms/pages/${pageSlug}/blocks/${blockId}/note`;
        const formData = new FormData();
        formData.append('_token', document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');
        formData.append('_method', 'PATCH');
        formData.append('note', note || '');
        
        return fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to save note');
            }
            return data;
        });
    }
    
    // Note modal handlers
    const noteModal = document.getElementById('block-note-modal');
    const noteTextarea = document.getElementById('block-note-textarea');
    const saveNoteBtn = document.getElementById('save-note-modal');
    const closeNoteBtn = document.getElementById('close-note-modal');
    const cancelNoteBtn = document.getElementById('cancel-note-modal');
    let currentNoteBlockId = null;
    
    function openNoteModal(blockId) {
        currentNoteBlockId = blockId;
        const note = getBlockNote(blockId);
        if (noteTextarea) noteTextarea.value = note || '';
        if (noteModal) {
            noteModal.classList.remove('hidden');
            noteModal.style.display = 'flex';
            if (noteTextarea) noteTextarea.focus();
        }
    }
    
    function closeNoteModal() {
        if (noteModal) {
            noteModal.classList.add('hidden');
            noteModal.style.display = 'none';
        }
        currentNoteBlockId = null;
        if (noteTextarea) noteTextarea.value = '';
    }
    
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', function() {
            if (currentNoteBlockId && noteTextarea) {
                const noteValue = noteTextarea.value || '';
                
                // Disable button during save
                saveNoteBtn.disabled = true;
                const originalText = saveNoteBtn.textContent;
                saveNoteBtn.textContent = 'Saving...';
                
                // Save to database via AJAX
                saveBlockNoteToDatabase(currentNoteBlockId, noteValue)
                    .then(data => {
                        // Update indicator with saved note
                        updateBlockNoteIndicator(currentNoteBlockId, noteValue);
                        closeNoteModal();
                        
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'success',
                                title: 'Note Saved',
                                text: data.message || 'Block note saved successfully',
                                timer: 1000,
                                showConfirmButton: false,
                                toast: true,
                                position: 'top-end'
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error saving note:', error);
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Failed to save note: ' + (error.message || 'An unexpected error occurred'),
                                timer: 2000,
                                showConfirmButton: false,
                                toast: true,
                                position: 'top-end'
                            });
                        }
                    })
                    .finally(() => {
                        // Re-enable button
                        saveNoteBtn.disabled = false;
                        saveNoteBtn.textContent = originalText;
                    });
            }
        });
    }
    
    if (closeNoteBtn) closeNoteBtn.addEventListener('click', closeNoteModal);
    if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', closeNoteModal);
    
    // Note button click handler
    document.addEventListener('click', function(e) {
        const noteBtn = e.target.closest('.block-note-btn');
        if (noteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const blockId = noteBtn.getAttribute('data-block-id');
            const tempId = noteBtn.getAttribute('data-temp-id');
            
            // For saved blocks, use block ID
            if (blockId) {
                openNoteModal(blockId);
            } 
            // For temp blocks, show a message that they need to be saved first
            else if (tempId) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Save Block First',
                        text: 'Please save the block first to add a note',
                        timer: 2000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            }
        }
    });
    
    // Initialize notes for existing blocks from DOM
    setTimeout(loadBlockNotes, 100);
    
    // ==========================================
    // BLOCK VISIBILITY RULES HANDLERS
    // ==========================================
    
    // Get visibility rules from DOM
    function getBlockVisibilityRules(blockId) {
        const li = document.querySelector(`li[data-block-id="${blockId}"]`);
        if (!li) return null;
        
        const rulesAttr = li.getAttribute('data-visibility-rules');
        if (!rulesAttr) return null;
        
        try {
            return JSON.parse(rulesAttr);
        } catch (e) {
            console.warn('Failed to parse visibility rules:', e);
            return null;
        }
    }
    
    // Update visibility rules indicator
    function updateBlockVisibilityRulesIndicator(blockId, rules = null) {
        const li = document.querySelector(`li[data-block-id="${blockId}"]`);
        if (!li) return;
        
        const btn = li.querySelector('.block-visibility-rules-btn');
        if (!btn) return;
        
        const hasRules = rules && (rules.enabled || rules.start_date || rules.end_date);
        
        // Update data attribute
        if (rules) {
            li.setAttribute('data-visibility-rules', JSON.stringify(rules));
        } else {
            li.setAttribute('data-visibility-rules', '{}');
        }
        
        // Update button appearance
        if (hasRules) {
            btn.classList.add('text-blue-600');
            btn.classList.remove('text-gray-400');
            btn.title = 'Edit visibility rules';
        } else {
            btn.classList.remove('text-blue-600');
            btn.classList.add('text-gray-400');
            btn.title = 'Set visibility rules';
        }
        
        // Apply visibility based on rules
        applyVisibilityRules(li, rules);
    }
    
    // Evaluate visibility rules based on current date
    function evaluateVisibilityRules(rules) {
        if (!rules || !rules.enabled) {
            return true; // No rules or disabled, block is visible
        }
        
        const now = new Date();
        
        // Check start date
        if (rules.start_date) {
            const startDate = new Date(rules.start_date);
            if (now < startDate) {
                return false; // Before start date, block is hidden
            }
        }
        
        // Check end date
        if (rules.end_date) {
            const endDate = new Date(rules.end_date);
            if (now > endDate) {
                return false; // After end date, block is hidden
            }
        }
        
        return true; // Within date range, block is visible
    }
    
    // Apply visibility rules to a block
    // In builder mode, blocks are always visible but show visual indicator
    // In preview/frontend mode, blocks are actually hidden
    function applyVisibilityRules(li, rules) {
        if (!li) return;
        
        const isVisible = evaluateVisibilityRules(rules);
        
        // In builder mode, always show blocks but add visual indicator
        const isBuilderMode = document.getElementById('blocks-list') !== null;
        
        if (isBuilderMode) {
            // Builder mode: show visual indicator but keep block visible for editing
            if (isVisible) {
                li.classList.remove('block-hidden-by-rules');
            } else {
                li.classList.add('block-hidden-by-rules');
            }
            // Always keep block visible in builder
            li.style.display = '';
        } else {
            // Preview/frontend mode: actually hide/show blocks
            if (isVisible) {
                li.classList.remove('block-hidden-by-rules');
                li.style.display = '';
            } else {
                li.classList.add('block-hidden-by-rules');
                li.style.display = 'none';
            }
        }
    }
    
    // Apply visibility rules to all blocks
    function applyAllVisibilityRules() {
        const blocksList = document.getElementById('blocks-list');
        if (!blocksList) return;
        
        const blocks = blocksList.querySelectorAll('li[data-block-id], li[data-temp-id]');
        blocks.forEach(li => {
            const blockId = li.getAttribute('data-block-id');
            if (blockId) {
                const rules = getBlockVisibilityRules(blockId);
                applyVisibilityRules(li, rules);
            }
        });
    }
    
    // Save visibility rules via AJAX to database
    function saveBlockVisibilityRulesToDatabase(blockId, rules) {
        const pageSlug = window.location.pathname.match(/\/pages\/([^\/]+)\//)?.[1];
        if (!pageSlug || !blockId) {
            console.error('Page slug or block ID not found');
            return Promise.reject('Page slug or block ID not found');
        }
        
        const url = `/admin/cms/pages/${pageSlug}/blocks/${blockId}/visibility-rules`;
        const formData = new FormData();
        formData.append('_token', document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');
        formData.append('_method', 'PATCH');
        formData.append('enabled', rules && rules.enabled ? '1' : '0');
        if (rules && rules.start_date) {
            formData.append('start_date', rules.start_date);
        }
        if (rules && rules.end_date) {
            formData.append('end_date', rules.end_date);
        }
        
        return fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to save visibility rules');
            }
            return data;
        });
    }
    
    // Visibility rules modal handlers
    const visibilityRulesModal = document.getElementById('block-visibility-rules-modal');
    const visibilityRulesEnabled = document.getElementById('visibility-rules-enabled');
    const visibilityRulesOptions = document.getElementById('visibility-rules-options');
    const visibilityRulesStartDate = document.getElementById('visibility-rules-start-date');
    const visibilityRulesEndDate = document.getElementById('visibility-rules-end-date');
    const saveVisibilityRulesBtn = document.getElementById('save-visibility-rules-modal');
    const closeVisibilityRulesBtn = document.getElementById('close-visibility-rules-modal');
    const cancelVisibilityRulesBtn = document.getElementById('cancel-visibility-rules-modal');
    let currentVisibilityRulesBlockId = null;
    
    // Toggle options visibility based on enabled checkbox
    if (visibilityRulesEnabled && visibilityRulesOptions) {
        visibilityRulesEnabled.addEventListener('change', function() {
            if (this.checked) {
                visibilityRulesOptions.style.display = 'block';
            } else {
                visibilityRulesOptions.style.display = 'none';
            }
        });
    }
    
    function openVisibilityRulesModal(blockId) {
        currentVisibilityRulesBlockId = blockId;
        const rules = getBlockVisibilityRules(blockId);
        
        if (visibilityRulesEnabled) {
            visibilityRulesEnabled.checked = rules && rules.enabled ? true : false;
        }
        
        if (visibilityRulesStartDate) {
            if (rules && rules.start_date) {
                // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
                const startDate = new Date(rules.start_date);
                const year = startDate.getFullYear();
                const month = String(startDate.getMonth() + 1).padStart(2, '0');
                const day = String(startDate.getDate()).padStart(2, '0');
                const hours = String(startDate.getHours()).padStart(2, '0');
                const minutes = String(startDate.getMinutes()).padStart(2, '0');
                visibilityRulesStartDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else {
                visibilityRulesStartDate.value = '';
            }
        }
        
        if (visibilityRulesEndDate) {
            if (rules && rules.end_date) {
                // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
                const endDate = new Date(rules.end_date);
                const year = endDate.getFullYear();
                const month = String(endDate.getMonth() + 1).padStart(2, '0');
                const day = String(endDate.getDate()).padStart(2, '0');
                const hours = String(endDate.getHours()).padStart(2, '0');
                const minutes = String(endDate.getMinutes()).padStart(2, '0');
                visibilityRulesEndDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else {
                visibilityRulesEndDate.value = '';
            }
        }
        
        // Show/hide options based on enabled state
        if (visibilityRulesOptions) {
            visibilityRulesOptions.style.display = visibilityRulesEnabled && visibilityRulesEnabled.checked ? 'block' : 'none';
        }
        
        if (visibilityRulesModal) {
            visibilityRulesModal.classList.remove('hidden');
            visibilityRulesModal.style.display = 'flex';
        }
    }
    
    function closeVisibilityRulesModal() {
        if (visibilityRulesModal) {
            visibilityRulesModal.classList.add('hidden');
            visibilityRulesModal.style.display = 'none';
        }
        currentVisibilityRulesBlockId = null;
        if (visibilityRulesEnabled) visibilityRulesEnabled.checked = false;
        if (visibilityRulesStartDate) visibilityRulesStartDate.value = '';
        if (visibilityRulesEndDate) visibilityRulesEndDate.value = '';
        if (visibilityRulesOptions) visibilityRulesOptions.style.display = 'none';
    }
    
    if (saveVisibilityRulesBtn) {
        saveVisibilityRulesBtn.addEventListener('click', function() {
            if (currentVisibilityRulesBlockId && visibilityRulesEnabled) {
                const enabled = visibilityRulesEnabled.checked;
                const startDate = visibilityRulesStartDate && visibilityRulesStartDate.value ? visibilityRulesStartDate.value : null;
                const endDate = visibilityRulesEndDate && visibilityRulesEndDate.value ? visibilityRulesEndDate.value : null;
                
                const rules = enabled ? {
                    enabled: true,
                    start_date: startDate,
                    end_date: endDate
                } : null;
                
                // Disable button during save
                saveVisibilityRulesBtn.disabled = true;
                const originalText = saveVisibilityRulesBtn.textContent;
                saveVisibilityRulesBtn.textContent = 'Saving...';
                
                // Save to database via AJAX
                saveBlockVisibilityRulesToDatabase(currentVisibilityRulesBlockId, rules)
                    .then(data => {
                        // Update indicator with saved rules
                        updateBlockVisibilityRulesIndicator(currentVisibilityRulesBlockId, rules);
                        closeVisibilityRulesModal();
                        
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'success',
                                title: 'Rules Saved',
                                text: data.message || 'Block visibility rules saved successfully',
                                timer: 1000,
                                showConfirmButton: false,
                                toast: true,
                                position: 'top-end'
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error saving visibility rules:', error);
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Failed to save visibility rules: ' + (error.message || 'An unexpected error occurred'),
                                timer: 2000,
                                showConfirmButton: false,
                                toast: true,
                                position: 'top-end'
                            });
                        }
                    })
                    .finally(() => {
                        // Re-enable button
                        saveVisibilityRulesBtn.disabled = false;
                        saveVisibilityRulesBtn.textContent = originalText;
                    });
            }
        });
    }
    
    if (closeVisibilityRulesBtn) closeVisibilityRulesBtn.addEventListener('click', closeVisibilityRulesModal);
    if (cancelVisibilityRulesBtn) cancelVisibilityRulesBtn.addEventListener('click', closeVisibilityRulesModal);
    
    // Visibility rules button click handler
    document.addEventListener('click', function(e) {
        const rulesBtn = e.target.closest('.block-visibility-rules-btn');
        if (rulesBtn) {
            e.preventDefault();
            e.stopPropagation();
            const blockId = rulesBtn.getAttribute('data-block-id');
            const tempId = rulesBtn.getAttribute('data-temp-id');
            
            // For saved blocks, use block ID
            if (blockId) {
                openVisibilityRulesModal(blockId);
            } 
            // For temp blocks, show a message that they need to be saved first
            else if (tempId) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Save Block First',
                        text: 'Please save the block first to set visibility rules',
                        timer: 2000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            }
        }
    });
    
    // Initialize visibility rules for existing blocks from DOM and apply them
    setTimeout(() => {
        applyAllVisibilityRules();
        
        // Re-evaluate visibility rules every minute (in case dates change)
        setInterval(applyAllVisibilityRules, 60000);
    }, 200);
    
    // ==========================================
    // UNDO/REDO BUTTON HANDLERS
    // ==========================================
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    function updateUndoRedoButtons() {
        if (undoBtn) {
            undoBtn.disabled = HistoryManager.currentIndex <= 0;
            undoBtn.classList.toggle('opacity-50', undoBtn.disabled);
        }
        if (redoBtn) {
            redoBtn.disabled = HistoryManager.currentIndex >= HistoryManager.history.length - 1;
            redoBtn.classList.toggle('opacity-50', redoBtn.disabled);
        }
    }
    
    if (undoBtn) {
        undoBtn.addEventListener('click', function() {
            const success = HistoryManager.undo();
            if (success) {
                updateUndoRedoButtons();
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Undone',
                        text: 'Last action undone',
                        timer: 1000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            }
        });
    }
    
    if (redoBtn) {
        redoBtn.addEventListener('click', function() {
            const success = HistoryManager.redo();
            if (success) {
                updateUndoRedoButtons();
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Redone',
                        text: 'Action redone',
                        timer: 1000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            }
        });
    }
    
    // Update buttons whenever history changes
    const originalSaveState = HistoryManager.saveState;
    HistoryManager.saveState = function() {
        originalSaveState.call(this);
        updateUndoRedoButtons();
    };
    
    const originalUndo = HistoryManager.undo;
    HistoryManager.undo = function() {
        const result = originalUndo.call(this);
        updateUndoRedoButtons();
        return result;
    };
    
    const originalRedo = HistoryManager.redo;
    HistoryManager.redo = function() {
        const result = originalRedo.call(this);
        updateUndoRedoButtons();
        return result;
    };
    
    // Initial button state
    updateUndoRedoButtons();
    
    // ==========================================
    // FEATURE 5: ENHANCED KEYBOARD SHORTCUTS
    // ==========================================
    // Add enhanced keyboard shortcuts handler (after all functions are defined)
    // Use capture phase to handle before other handlers
    document.addEventListener('keydown', function(e) {
        // Don't trigger if user is typing in an input field or textarea
        const activeEl = document.activeElement;
        const isInputFocused = 
            activeEl?.tagName === 'INPUT' ||
            activeEl?.tagName === 'TEXTAREA' ||
            (activeEl?.contentEditable === 'true' && !activeEl?.classList.contains('richtext-editor'));
        
        // Skip if in input (except for certain shortcuts that should work everywhere)
        const skipForInputs = ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
        if (isInputFocused && !skipForInputs.includes(e.key) && !((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p'))) {
            return;
        }
        
        // Ctrl+S / Cmd+S - Save (works even in inputs to allow saving)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            e.stopPropagation();
            const saveBtn = document.getElementById('save-btn');
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();
            }
            return;
        }
        
        // Ctrl+P / Cmd+P - Preview (works even in inputs)
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            e.stopPropagation();
            const previewBtn = document.getElementById('preview-btn');
            if (previewBtn && !previewBtn.disabled) {
                previewBtn.click();
            }
            return;
        }
        
        // Delete or Backspace - Delete selected block
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused) {
            const selectedBlocks = list?.querySelectorAll('li.block-selected');
            if (selectedBlocks && selectedBlocks.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                // Use the same logic as bulk delete
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Delete Blocks',
                        text: `Delete ${selectedBlocks.length} block(s)?`,
                        showCancelButton: true,
                        confirmButtonText: 'Delete',
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#dc2626'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            HistoryManager.saveState();
                            selectedBlocks.forEach(li => {
                                const blockId = li.getAttribute('data-block-id');
                                if (blockId && typeof window.deletedBlockIds !== 'undefined') {
                                    window.deletedBlockIds.add(parseInt(blockId));
                                }
                                li.remove();
                            });
                            if (typeof updateOrders === 'function') updateOrders(false);
                            if (typeof updateEmptyMessage === 'function') updateEmptyMessage();
                            HistoryManager.saveState();
                        }
                    });
                } else {
                    // Fallback to native confirm if SweetAlert2 hasn't loaded yet
                    if (confirm(`Delete ${selectedBlocks.length} block(s)?`)) {
                        HistoryManager.saveState();
                        selectedBlocks.forEach(li => {
                            const blockId = li.getAttribute('data-block-id');
                            if (blockId && typeof window.deletedBlockIds !== 'undefined') {
                                window.deletedBlockIds.add(parseInt(blockId));
                            }
                            li.remove();
                        });
                        if (typeof updateOrders === 'function') updateOrders(false);
                        if (typeof updateEmptyMessage === 'function') updateEmptyMessage();
                        HistoryManager.saveState();
                    }
                }
                return false;
            } else {
                // Delete focused block if no selection
                const activeBlock = document.querySelector('li.block-focused');
                if (activeBlock) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const blockId = activeBlock.getAttribute('data-block-id');
                    if (blockId && typeof window.deletedBlockIds !== 'undefined') {
                        window.deletedBlockIds.add(parseInt(blockId));
                    }
                    activeBlock.remove();
                    if (typeof updateOrders === 'function') updateOrders(false);
                    if (typeof updateEmptyMessage === 'function') updateEmptyMessage();
                    return false;
                }
            }
        }
        
        // Ctrl+D / Cmd+D - Duplicate selected block
        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isInputFocused) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const selectedBlocks = list?.querySelectorAll('li.block-selected');
            if (selectedBlocks && selectedBlocks.length > 0) {
                // Call duplicateBlock function directly for each selected block
                selectedBlocks.forEach(li => {
                    if (typeof duplicateBlock === 'function') {
                        duplicateBlock(li);
                    } else {
                        // Fallback: try clicking the button
                        const dupBtn = li.querySelector('.block-duplicate-btn, .temp-duplicate-btn');
                        if (dupBtn) {
                            dupBtn.click();
                        }
                    }
                });
            }
            return false;
        }
        
        // Ctrl+C / Cmd+C - Copy block (if not in input)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isInputFocused) {
            const selectedBlocks = list?.querySelectorAll('li.block-selected');
            if (selectedBlocks && selectedBlocks.length === 1) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (typeof copyBlockToClipboard === 'function') {
                    copyBlockToClipboard(selectedBlocks[0]);
                }
                return false;
            }
        }
        
        // Ctrl+V / Cmd+V - Paste block (if not in input)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInputFocused) {
            const pasteBtn = document.getElementById('paste-block-btn');
            if (pasteBtn && !pasteBtn.disabled) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (typeof pasteBlockFromClipboard === 'function') {
                    pasteBlockFromClipboard();
                } else {
                    pasteBtn.click();
                }
                return false;
            }
        }
        
        // Escape - Close modals (already working, but keep it here)
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('[id$="-modal"]:not(.hidden)');
            modals.forEach(modal => {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            });
            // Close dropdowns
            document.querySelectorAll('[id$="-dropdown"]:not(.hidden)').forEach(dropdown => {
                dropdown.classList.add('hidden');
            });
            // Clear search
            const searchInput = document.getElementById('block-search-input');
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                if (typeof filterBlocks === 'function') {
                    filterBlocks('');
                }
            }
            return;
        }
        
        // / - Quick search (if not in input) - already working, keep it here
        if (e.key === '/' && !isInputFocused) {
            const searchInput = document.getElementById('block-search-input');
            if (searchInput) {
                e.preventDefault();
                e.stopPropagation();
                searchInput.focus();
            }
            return;
        }
        
        // Arrow keys - Navigate blocks (if not in input) - already working, keep it here
        if (!isInputFocused && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            if (!list) return;
            const blocks = Array.from(list.querySelectorAll('li[data-block-id], li[data-temp-id]'));
            if (blocks.length === 0) return;
            
            const currentFocus = document.querySelector('li.block-focused');
            let currentIndex = -1;
            
            if (currentFocus) {
                currentIndex = blocks.indexOf(currentFocus);
            }
            
            if (e.key === 'ArrowDown' && currentIndex < blocks.length - 1) {
                e.preventDefault();
                e.stopPropagation();
                const nextBlock = blocks[currentIndex + 1];
                if (currentFocus) currentFocus.classList.remove('block-focused');
                nextBlock.classList.add('block-focused');
                nextBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else if (e.key === 'ArrowUp' && currentIndex > 0) {
                e.preventDefault();
                e.stopPropagation();
                const prevBlock = blocks[currentIndex - 1];
                if (currentFocus) currentFocus.classList.remove('block-focused');
                prevBlock.classList.add('block-focused');
                prevBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else if (currentIndex === -1 && blocks.length > 0) {
                // If no block is focused, focus the first one
                e.preventDefault();
                e.stopPropagation();
                blocks[0].classList.add('block-focused');
                blocks[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, true); // Use capture phase to handle before other handlers
    
    // ==========================================
    // AUTO-SAVE / DRAFT SYSTEM
    // ==========================================
    const AutoSaveManager = {
        isEnabled: true,
        interval: 45000, // 45 seconds (between 30-60 as recommended)
        timeoutId: null,
        lastSaved: null,
        hasUnsavedChanges: false,
        isSaving: false,
        debounceTimeout: null,
        debounceDelay: 2000, // Save 2 seconds after last change
        
        init() {
            if (!this.isEnabled) return;
            
            // Set initial state
            this.updateStatus('saved', 'All changes saved');
            this.lastSaved = new Date();
            
            // Start periodic auto-save
            this.startPeriodicSave();
            
            // Listen for changes
            this.attachChangeListeners();
            
            // Save on page unload (beforeunload)
            window.addEventListener('beforeunload', (e) => {
                if (this.hasUnsavedChanges) {
                    // Use sendBeacon for reliable unload save
                    try {
                        const blocksData = typeof collectAllBlocksData === 'function' ? collectAllBlocksData() : [];
                        const customCssTextarea = document.querySelector('textarea[name="custom_css"]');
                        const bodyBgColorInput = document.querySelector('input[name="body_bg_color"]');
                        const cardBgColorInput = document.querySelector('input[name="card_bg_color"]');
                        
                        const formData = new FormData();
                        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                        
                        if (csrfToken) {
                            formData.append('_token', csrfToken);
                            formData.append('blocks', JSON.stringify(blocksData));
                            formData.append('auto_save', '1');
                            
                            if(customCssTextarea) formData.append('custom_css', customCssTextarea.value);
                            if(bodyBgColorInput) formData.append('body_bg_color', bodyBgColorInput.value);
                            if(cardBgColorInput) formData.append('card_bg_color', cardBgColorInput.value);
                            
                            const saveUrl = typeof window.PAGE_SAVE_ROUTE !== 'undefined' ? window.PAGE_SAVE_ROUTE : 
                                          window.location.href.replace(/\/builder$/, '/save');
                            
                            // Use sendBeacon for reliable save on unload
                            const blob = new Blob([formData], { type: 'application/x-www-form-urlencoded' });
                            navigator.sendBeacon(saveUrl, blob);
                        }
                    } catch (error) {
                        console.error('Error saving on unload:', error);
                    }
                    
                    // Show browser warning
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
        },
        
        attachChangeListeners() {
            // Track block additions
            if (list) {
                const blockObserver = new MutationObserver(() => {
                    if (!HistoryManager.isExecuting) {
                        this.markUnsaved();
                    }
                });
                
                blockObserver.observe(list, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['data-content', 'data-width', 'data-block-id', 'data-temp-id']
                });
            }
            
            // Track content input changes (debounced)
            document.addEventListener('input', (e) => {
                const target = e.target;
                if (target.closest('.block-edit-form') || 
                    target.name === 'custom_css' ||
                    target.name === 'body_bg_color' ||
                    target.name === 'card_bg_color') {
                    this.markUnsaved();
                }
            }, true);
            
            // Track select changes
            document.addEventListener('change', (e) => {
                const target = e.target;
                if (target.closest('.block-edit-form') || 
                    target.closest('.page-settings-card')) {
                    this.markUnsaved();
                }
            }, true);
        },
        
        markUnsaved() {
            if (this.isSaving) return;
            
            this.hasUnsavedChanges = true;
            this.updateStatus('unsaved', 'Unsaved changes');
            
            // Clear existing debounce timeout
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }
            
            // Debounce: save after delay if no more changes
            this.debounceTimeout = setTimeout(() => {
                if (this.hasUnsavedChanges && !this.isSaving) {
                    this.save();
                }
            }, this.debounceDelay);
        },
        
        startPeriodicSave() {
            if (this.timeoutId) {
                clearInterval(this.timeoutId);
            }
            
            this.timeoutId = setInterval(() => {
                if (this.hasUnsavedChanges && !this.isSaving) {
                    this.save();
                }
            }, this.interval);
        },
        
        async save(isForce = false) {
            if (this.isSaving && !isForce) return;
            if (!this.hasUnsavedChanges && !isForce) return;
            
            this.isSaving = true;
            this.updateStatus('saving', 'Saving...');
            
            try {
                // Collect blocks data
                const blocksData = typeof collectAllBlocksData === 'function' ? collectAllBlocksData() : [];
                
                // Collect page settings
                const customCssTextarea = document.querySelector('textarea[name="custom_css"]');
                const bodyBgColorInput = document.querySelector('input[name="body_bg_color"]');
                const cardBgColorInput = document.querySelector('input[name="card_bg_color"]');
                
                // Create form data
                const formData = new FormData();
                
                // Get CSRF token from meta tag or form
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                                 document.querySelector('input[name="_token"]')?.value ||
                                 '';
                
                formData.append('_token', csrfToken);
                formData.append('blocks', JSON.stringify(blocksData));
                formData.append('auto_save', '1'); // Flag to indicate auto-save
                
                // Add deleted block IDs if any blocks were deleted
                if (typeof window.deletedBlockIds !== 'undefined' && window.deletedBlockIds.size > 0) {
                    formData.append('deleted_block_ids', JSON.stringify(Array.from(window.deletedBlockIds)));
                }
                
                if(customCssTextarea) formData.append('custom_css', customCssTextarea.value);
                if(bodyBgColorInput) formData.append('body_bg_color', bodyBgColorInput.value);
                if(cardBgColorInput) formData.append('card_bg_color', cardBgColorInput.value);
                
                // Get save URL - try from global variable, form action, or construct from current URL
                let saveUrl = '';
                
                // Try global variable first (set by Laravel)
                if (typeof window.PAGE_SAVE_ROUTE !== 'undefined' && window.PAGE_SAVE_ROUTE) {
                    saveUrl = window.PAGE_SAVE_ROUTE;
                } else {
                    // Try to find form with save action
                    const forms = document.querySelectorAll('form[action*="save"]');
                    if (forms.length > 0) {
                        saveUrl = forms[0].getAttribute('action');
                    }
                    
                    // Fallback: construct from current URL
                    if (!saveUrl) {
                        const currentUrl = window.location.href;
                        saveUrl = currentUrl.replace(/\/builder$/, '/save');
                    }
                }
                
                const response = await fetch(saveUrl, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    this.hasUnsavedChanges = false;
                    this.lastSaved = new Date();
                    this.updateStatus('saved', 'All changes saved', this.lastSaved);
                    
                    // Clear deleted block IDs after successful save
                    if (typeof window.deletedBlockIds !== 'undefined') {
                        window.deletedBlockIds.clear();
                    }
                } else {
                    throw new Error(data.message || 'Failed to auto-save');
                }
            } catch (error) {
                console.error('Auto-save error:', error);
                this.updateStatus('error', 'Failed to save');
                
                // Retry after delay if not forced
                if (!isForce) {
                    setTimeout(() => {
                        if (this.hasUnsavedChanges) {
                            this.save();
                        }
                    }, 5000); // Retry after 5 seconds
                }
            } finally {
                this.isSaving = false;
            }
        },
        
        updateStatus(state, text, savedTime = null) {
            const statusEl = document.getElementById('auto-save-status');
            const statusIcon = document.getElementById('auto-save-status-icon');
            const statusText = document.getElementById('auto-save-status-text');
            const statusTime = document.getElementById('auto-save-status-time');
            
            if (!statusEl) return;
            
            // Remove all state classes
            statusEl.classList.remove('saving', 'saved', 'unsaved', 'error');
            
            // Add current state class
            if (state) {
                statusEl.classList.add(state);
            }
            
            // Update icon
            if (statusIcon) {
                const iconEl = statusIcon.querySelector('i');
                if (iconEl) {
                    iconEl.className = 'fas fa-circle text-xs';
                }
            }
            
            // Update text
            if (statusText) {
                statusText.textContent = text;
            }
            
            // Update time
            if (statusTime && savedTime) {
                const timeStr = this.formatTime(savedTime);
                statusTime.textContent = timeStr ? ` · ${timeStr}` : '';
            } else if (statusTime) {
                statusTime.textContent = '';
            }
        },
        
        formatTime(date) {
            if (!date) return '';
            
            const now = new Date();
            const diffMs = now - date;
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            
            if (diffSecs < 60) {
                return 'Just now';
            } else if (diffMins < 60) {
                return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
            } else {
                const hours = Math.floor(diffMins / 60);
                if (hours < 24) {
                    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
                } else {
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            }
        }
    };
    
    // Initialize auto-save after DOM is ready
    // Wait a bit to ensure everything is loaded
    setTimeout(() => {
        AutoSaveManager.init();
    }, 1000);
    
    // Expose AutoSaveManager globally for manual saves
    window.AutoSaveManager = AutoSaveManager;
    
    // ==========================================
    // Performance Metrics Manager
    // ==========================================
    const PerformanceMetrics = {
        // Block complexity weights (higher = more complex/heavy)
        complexityWeights: {
            'heading': 1,
            'richtext': 2,
            'image': 3,
            'button': 1,
            'video': 8,
            'code': 5,
            'divider': 0.5,
            'spacer': 0.5,
            'testimonial': 3,
            'gallery': 10,
            'hero_section': 12,
            'map': 6,
            'two_column': 15,
            'three_column': 20,
            'blog_list': 4,
            'blog_featured': 3
        },
        
        // Estimated sizes for different image types (in bytes)
        estimatedImageSizes: {
            'jpg': 150000, // ~150KB average
            'jpeg': 150000,
            'png': 200000, // ~200KB average
            'gif': 50000, // ~50KB average
            'webp': 80000, // ~80KB average (optimized)
            'svg': 10000, // ~10KB average
            'default': 150000
        },
        
        // Initialize performance metrics
        init() {
            // Initial update
            this.updateMetrics();
            
            // Debounced update function
            let updateTimeout;
            const debouncedUpdate = () => {
                clearTimeout(updateTimeout);
                updateTimeout = setTimeout(() => {
                    this.updateMetrics();
                }, 1000); // Increased debounce to 1 second for better performance
            };
            
            // Update metrics when blocks change (with debouncing)
            const blocksList = document.getElementById('blocks-list');
            if (blocksList) {
                const observer = new MutationObserver(() => {
                    debouncedUpdate();
                });
                
                observer.observe(blocksList, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['data-block-id', 'data-width']
                });
            }
            
            // Debounced update on any block content change
            document.addEventListener('input', debouncedUpdate);
        },
        
        // Get all blocks from the builder
        getAllBlocks() {
            const blocksList = document.getElementById('blocks-list');
            if (!blocksList) return [];
            
            const blockElements = blocksList.querySelectorAll('li[data-block-id], li[data-temp-id]');
            const blocks = [];
            
            blockElements.forEach(li => {
                const preview = li.querySelector('.block-preview');
                if (preview) {
                    const blockType = preview.getAttribute('data-type');
                    const contentAttr = preview.getAttribute('data-content');
                    let content = {};
                    
                    try {
                        if (contentAttr) {
                            content = typeof contentAttr === 'string' ? JSON.parse(contentAttr) : contentAttr;
                        }
                    } catch (e) {
                        console.warn('Failed to parse block content', e);
                    }
                    
                    blocks.push({
                        type: blockType,
                        content: content,
                        element: li
                    });
                }
            });
            
            return blocks;
        },
        
        // Calculate block count and complexity
        calculateBlockMetrics(blocks) {
            const totalBlocks = blocks.length;
            let complexityScore = 0;
            
            blocks.forEach(block => {
                const weight = this.complexityWeights[block.type] || 2;
                complexityScore += weight;
                
                // Add extra weight for nested blocks (columns)
                if (block.type === 'two_column' || block.type === 'three_column') {
                    const numColumns = block.type === 'two_column' ? 2 : 3;
                    const columns = block.content.columns || [];
                    columns.forEach(column => {
                        const nestedBlocks = column.blocks || [];
                        nestedBlocks.forEach(nestedBlock => {
                            const nestedWeight = this.complexityWeights[nestedBlock.type] || 2;
                            complexityScore += nestedWeight * 0.5; // Nested blocks count less
                        });
                    });
                }
            });
            
            let complexityLevel = 'Low';
            if (complexityScore > 50) complexityLevel = 'Very High';
            else if (complexityScore > 30) complexityLevel = 'High';
            else if (complexityScore > 15) complexityLevel = 'Medium';
            
            return {
                total: totalBlocks,
                complexityScore: complexityScore,
                complexityLevel: complexityLevel
            };
        },
        
        // Calculate image metrics (optimized - synchronous, no async fetching)
        calculateImageMetrics(blocks) {
            const images = [];
            let totalEstimatedSize = 0;
            
            blocks.forEach(block => {
                // Image block
                if (block.type === 'image' && block.content.src) {
                    images.push({
                        src: block.content.src,
                        type: 'image',
                        blockType: block.type
                    });
                    totalEstimatedSize += this.estimateImageSize(block.content.src);
                }
                
                // Gallery block
                if (block.type === 'gallery' && block.content.images) {
                    block.content.images.forEach(img => {
                        if (img.src) {
                            images.push({
                                src: img.src,
                                type: 'gallery',
                                blockType: block.type
                            });
                            totalEstimatedSize += this.estimateImageSize(img.src);
                        }
                    });
                }
                
                // Testimonial block
                if (block.type === 'testimonial' && block.content.image) {
                    images.push({
                        src: block.content.image,
                        type: 'testimonial',
                        blockType: block.type
                    });
                    totalEstimatedSize += this.estimateImageSize(block.content.image);
                }
                
                // Hero section
                if (block.type === 'hero_section' && block.content.background_image_url) {
                    images.push({
                        src: block.content.background_image_url,
                        type: 'hero_background',
                        blockType: block.type
                    });
                    totalEstimatedSize += this.estimateImageSize(block.content.background_image_url);
                }
                
                // Heading block
                if (block.type === 'heading' && block.content.backgroundImage) {
                    images.push({
                        src: block.content.backgroundImage,
                        type: 'heading_background',
                        blockType: block.type
                    });
                    totalEstimatedSize += this.estimateImageSize(block.content.backgroundImage);
                }
                
                // Rich text block
                if (block.type === 'richtext' && block.content.backgroundImage) {
                    images.push({
                        src: block.content.backgroundImage,
                        type: 'richtext_background',
                        blockType: block.type
                    });
                    totalEstimatedSize += this.estimateImageSize(block.content.backgroundImage);
                }
            });
            
            // Skip actual size fetching for speed - use estimates only
            const actualSizes = { total: 0, perImage: {} };
            
            return {
                total: images.length,
                estimatedSize: totalEstimatedSize,
                actualSize: totalEstimatedSize, // Use estimated size as actual
                images: images,
                warnings: this.generateImageWarnings(images, actualSizes)
            };
        },
        
        // Estimate image size from URL
        estimateImageSize(src) {
            if (!src) return 0;
            
            const extension = src.split('.').pop().toLowerCase().split('?')[0];
            return this.estimatedImageSizes[extension] || this.estimatedImageSizes.default;
        },
        
        // Try to get actual image sizes (optimized - skip fetching for speed)
        async getActualImageSizes(images) {
            // Skip actual fetching to improve performance - use estimates instead
            // This dramatically speeds up the calculation
            // If you need actual sizes, you can enable this but limit to first few images
            return {
                total: 0, // Will use estimated size instead
                perImage: {}
            };
            
            // OPTIONAL: Uncomment below to fetch sizes (but limit to first 5 images for speed)
            /*
            let totalActualSize = 0;
            const sizePromises = [];
            const maxImages = 5; // Limit to first 5 images for speed
            
            images.slice(0, maxImages).forEach(img => {
                if (img.src && (img.src.startsWith('/') || img.src.startsWith('http'))) {
                    const promise = fetch(img.src, { 
                        method: 'HEAD',
                        signal: AbortSignal.timeout(2000) // 2 second timeout
                    })
                        .then(response => {
                            const contentLength = response.headers.get('content-length');
                            if (contentLength) {
                                return parseInt(contentLength);
                            }
                            return 0;
                        })
                        .catch(() => 0);
                    
                    sizePromises.push(promise);
                }
            });
            
            try {
                const sizes = await Promise.allSettled(sizePromises);
                totalActualSize = sizes.reduce((sum, result) => {
                    return sum + (result.status === 'fulfilled' ? result.value : 0);
                }, 0);
            } catch (e) {
                console.warn('Failed to fetch actual image sizes', e);
            }
            
            return {
                total: totalActualSize || 0,
                perImage: {}
            };
            */
        },
        
        // Generate image warnings (soft checks - only for very large issues)
        generateImageWarnings(images, actualSizes) {
            const warnings = [];
            const largeImages = [];
            
            images.forEach((img, index) => {
                const estimatedSize = this.estimateImageSize(img.src);
                const actualSize = actualSizes.perImage[index] || estimatedSize;
                const size = actualSize || estimatedSize;
                
                // Check for very large images (>1MB) - more lenient threshold
                if (size > 1000000) {
                    largeImages.push({
                        src: img.src,
                        size: this.formatBytes(size),
                        type: img.type
                    });
                }
            });
            
            // Only warn if there are many very large images or single extremely large one
            if (largeImages.length > 3) {
                warnings.push({
                    type: 'warning',
                    message: `${largeImages.length} very large image${largeImages.length > 1 ? 's' : ''} detected (>1MB each). Consider compressing them for better performance.`,
                    items: largeImages
                });
            } else if (largeImages.length > 0) {
                // Re-check sizes to find extremely large images (>2MB)
                const extremelyLarge = [];
                images.forEach((img, index) => {
                    const estimatedSize = this.estimateImageSize(img.src);
                    const actualSize = actualSizes.perImage[index] || estimatedSize;
                    const size = actualSize || estimatedSize;
                    
                    if (size > 2000000) { // >2MB
                        extremelyLarge.push({
                            src: img.src,
                            size: this.formatBytes(size),
                            type: img.type
                        });
                    }
                });
                
                if (extremelyLarge.length > 0) {
                    warnings.push({
                        type: 'warning',
                        message: `${extremelyLarge.length} extremely large image${extremelyLarge.length > 1 ? 's' : ''} detected (>2MB). These should be compressed or optimized.`,
                        items: extremelyLarge
                    });
                }
            }
            
            // Check total image size - only warn if extremely large (>5MB)
            const totalSize = actualSizes.total || images.reduce((sum, img) => sum + this.estimateImageSize(img.src), 0);
            if (totalSize > 5000000) { // >5MB
                warnings.push({
                    type: 'warning',
                    message: `Total image size is ${this.formatBytes(totalSize)}. This is very large and may significantly slow down page loading. Consider lazy loading or reducing image sizes.`
                });
            }
            
            return warnings;
        },
        
        // Calculate estimated load time
        calculateLoadTime(blocks, imageMetrics) {
            // Base load time (HTML/CSS parsing, JS execution)
            let baseTime = 200; // 200ms
            
            // Add time based on block count and complexity
            const blockMetrics = this.calculateBlockMetrics(blocks);
            baseTime += blockMetrics.complexityScore * 5; // 5ms per complexity point
            
            // Add time based on images
            const totalImageSize = imageMetrics.actualSize || imageMetrics.estimatedSize;
            
            // Network speeds (in bits per second)
            const speed3G = 1.6 * 1024 * 1024; // 1.6 Mbps
            const speed4G = 12 * 1024 * 1024; // 12 Mbps
            
            // Calculate load times
            const loadTime3G = baseTime + (totalImageSize * 8 / speed3G * 1000); // Convert to ms
            const loadTime4G = baseTime + (totalImageSize * 8 / speed4G * 1000);
            
            // Average load time (assume 4G)
            const averageLoadTime = loadTime4G;
            
            return {
                average: averageLoadTime,
                fast3g: loadTime3G,
                fast4g: loadTime4G
            };
        },
        
        // Calculate performance score (0-100)
        calculatePerformanceScore(blockMetrics, imageMetrics, loadTime) {
            let score = 100;
            
            // Deduct points for too many blocks
            if (blockMetrics.total > 30) {
                score -= Math.min(20, (blockMetrics.total - 30) * 0.5);
            } else if (blockMetrics.total > 20) {
                score -= Math.min(10, (blockMetrics.total - 20) * 0.5);
            }
            
            // Deduct points for high complexity
            if (blockMetrics.complexityScore > 50) {
                score -= Math.min(25, (blockMetrics.complexityScore - 50) * 0.5);
            } else if (blockMetrics.complexityScore > 30) {
                score -= Math.min(15, (blockMetrics.complexityScore - 30) * 0.5);
            }
            
            // Deduct points for large images
            const totalImageSize = imageMetrics.actualSize || imageMetrics.estimatedSize;
            if (totalImageSize > 3000000) { // >3MB
                score -= Math.min(20, (totalImageSize - 3000000) / 100000);
            } else if (totalImageSize > 1500000) { // >1.5MB
                score -= Math.min(10, (totalImageSize - 1500000) / 150000);
            }
            
            // Deduct points for slow load time
            if (loadTime.average > 3000) {
                score -= Math.min(25, (loadTime.average - 3000) / 100);
            } else if (loadTime.average > 2000) {
                score -= Math.min(15, (loadTime.average - 2000) / 67);
            }
            
            // Deduct points for warnings
            score -= imageMetrics.warnings.length * 2;
            
            return Math.max(0, Math.round(score));
        },
        
        // Generate performance warnings (soft checks - only warn when truly problematic)
        generateWarnings(blockMetrics, imageMetrics, loadTime) {
            const warnings = [];
            const blocks = blockMetrics.blocks || [];
            
            // Too many blocks - only warn if extremely high (>60 blocks)
            if (blockMetrics.total > 60) {
                warnings.push({
                    message: `Page has ${blockMetrics.total} blocks. Consider splitting into multiple pages for better performance.`
                });
            }
            
            // High complexity - only warn if very high complexity AND slow load time
            if (blockMetrics.complexityScore > 100 && loadTime.average > 8000) {
                warnings.push({
                    message: `Very high page complexity (${blockMetrics.complexityLevel}) with slow load time. This may significantly impact user experience.`
                });
            }
            
            // Heavy blocks - only warn if many heavy blocks (>5) AND slow load time
            const heavyBlocks = [];
            blockMetrics.heavyBlocks = [];
            blocks.forEach(block => {
                const weight = this.complexityWeights[block.type] || 2;
                if (weight >= 10) {
                    heavyBlocks.push({
                        type: block.type,
                        weight: weight
                    });
                    blockMetrics.heavyBlocks.push(block.type);
                }
            });
            
            if (heavyBlocks.length > 5 && loadTime.average > 8000) {
                warnings.push({
                    message: `${heavyBlocks.length} heavy block${heavyBlocks.length > 1 ? 's' : ''} detected (${heavyBlocks.map(b => b.type).join(', ')}) with slow load time. Consider optimizing.`
                });
            }
            
            // Slow load time - only warn if extremely slow (>8 seconds / 8000ms)
            if (loadTime.average > 8000) {
                warnings.push({
                    message: `Estimated load time is ${this.formatTime(loadTime.average)}. This is very slow and may significantly impact user experience. Consider optimizing images and reducing page complexity.`
                });
            }
            
            // Add critical image warnings only (filter out minor issues)
            imageMetrics.warnings.forEach(warning => {
                // Only show warnings about very large images (>1MB) or huge total size (>5MB)
                if (warning.message.includes('Total image size') || 
                    warning.message.includes('>1MB') || 
                    warning.message.includes('>2MB') ||
                    warning.message.includes('extremely large')) {
                    warnings.push({
                        message: warning.message
                    });
                }
            });
            
            return warnings;
        },
        
        // Generate optimization suggestions
        generateSuggestions(blockMetrics, imageMetrics, loadTime) {
            const suggestions = [];
            const blocks = blockMetrics.blocks || [];
            
            // Image optimization
            if (imageMetrics.total > 5) {
                suggestions.push({
                    message: 'Enable lazy loading for images to improve initial page load time.'
                });
            }
            
            if (imageMetrics.warnings.some(w => w.message.includes('WebP'))) {
                suggestions.push({
                    message: 'Convert images to WebP format for better compression and faster loading.'
                });
            }
            
            // Block optimization
            if (blockMetrics.complexityScore > 30) {
                suggestions.push({
                    message: 'Consider using simpler block types or combining multiple blocks where possible.'
                });
            }
            
            // Video optimization
            const hasVideo = blocks.some(b => b.type === 'video');
            if (hasVideo) {
                suggestions.push({
                    message: 'Ensure videos are properly optimized and consider lazy loading for better performance.'
                });
            }
            
            // Load time suggestions
            if (loadTime.average > 2000) {
                suggestions.push({
                    message: 'Consider implementing code splitting or reducing the number of heavy blocks.'
                });
            }
            
            return suggestions;
        },
        
        // Format bytes to human-readable string
        formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },
        
        // Format time to human-readable string
        formatTime(ms) {
            if (ms < 1000) return Math.round(ms) + 'ms';
            return (Math.round(ms / 100) / 10).toFixed(1) + 's';
        },
        
        // Update all metrics in the UI (optimized - synchronous for speed)
        updateMetrics() {
            const blocks = this.getAllBlocks();
            
            if (blocks.length === 0) {
                this.renderEmptyMetrics();
                return;
            }
            
            // Show loading state immediately
            const scoreTextEl = document.getElementById('performance-score-text');
            if (scoreTextEl) {
                scoreTextEl.textContent = 'Calculating...';
            }
            
            // Use requestAnimationFrame to make calculation non-blocking
            requestAnimationFrame(() => {
                // Calculate block metrics
                const blockMetrics = this.calculateBlockMetrics(blocks);
                blockMetrics.blocks = blocks; // Store for warnings
                
                // Calculate image metrics (now synchronous)
                const imageMetrics = this.calculateImageMetrics(blocks);
                
                // Calculate load time
                const loadTime = this.calculateLoadTime(blocks, imageMetrics);
                
                // Calculate performance score
                const score = this.calculatePerformanceScore(blockMetrics, imageMetrics, loadTime);
                
                // Generate warnings and suggestions
                const warnings = this.generateWarnings(blockMetrics, imageMetrics, loadTime);
                const suggestions = this.generateSuggestions(blockMetrics, imageMetrics, loadTime);
                
                // Render all metrics
                this.renderMetrics({
                    score,
                    blockMetrics,
                    imageMetrics,
                    loadTime,
                    warnings,
                    suggestions
                });
            });
        },
        
        // Render metrics to the UI
        renderMetrics(data) {
            // Performance score
            const scoreEl = document.getElementById('performance-score');
            const scoreBarEl = document.getElementById('performance-score-bar');
            const scoreTextEl = document.getElementById('performance-score-text');
            
            if (scoreEl && scoreBarEl && scoreTextEl) {
                scoreEl.textContent = data.score;
                scoreBarEl.style.width = data.score + '%';
                
                // Set score class
                scoreEl.className = 'text-lg font-bold';
                scoreBarEl.className = 'h-2 rounded-full transition-all duration-300';
                
                if (data.score >= 80) {
                    scoreEl.classList.add('excellent');
                    scoreBarEl.classList.add('excellent');
                    scoreTextEl.textContent = 'Excellent performance';
                } else if (data.score >= 60) {
                    scoreEl.classList.add('good');
                    scoreBarEl.classList.add('good');
                    scoreTextEl.textContent = 'Good performance';
                } else if (data.score >= 40) {
                    scoreEl.classList.add('fair');
                    scoreBarEl.classList.add('fair');
                    scoreTextEl.textContent = 'Fair performance - consider optimization';
                } else {
                    scoreEl.classList.add('poor');
                    scoreBarEl.classList.add('poor');
                    scoreTextEl.textContent = 'Poor performance - optimization required';
                }
            }
            
            // Block metrics
            const totalBlocksEl = document.getElementById('metric-total-blocks');
            const complexityEl = document.getElementById('metric-complexity');
            
            if (totalBlocksEl) totalBlocksEl.textContent = data.blockMetrics.total;
            if (complexityEl) {
                complexityEl.textContent = data.blockMetrics.complexityLevel;
                // Color code complexity
                complexityEl.className = 'text-lg font-semibold';
                if (data.blockMetrics.complexityLevel === 'Very High') {
                    complexityEl.classList.add('text-red-600');
                } else if (data.blockMetrics.complexityLevel === 'High') {
                    complexityEl.classList.add('text-orange-600');
                } else if (data.blockMetrics.complexityLevel === 'Medium') {
                    complexityEl.classList.add('text-yellow-600');
                } else {
                    complexityEl.classList.add('text-gray-900');
                }
            }
            
            // Image metrics
            const totalImagesEl = document.getElementById('metric-total-images');
            const totalImageSizeEl = document.getElementById('metric-total-image-size');
            const imageWarningsEl = document.getElementById('image-warnings');
            
            if (totalImagesEl) totalImagesEl.textContent = data.imageMetrics.total;
            if (totalImageSizeEl) {
                const size = data.imageMetrics.actualSize || data.imageMetrics.estimatedSize;
                totalImageSizeEl.textContent = this.formatBytes(size);
            }
            
            if (imageWarningsEl) {
                imageWarningsEl.innerHTML = '';
                if (data.imageMetrics.warnings.length > 0) {
                    data.imageMetrics.warnings.forEach(warning => {
                        const warningDiv = document.createElement('div');
                        warningDiv.className = 'performance-warning-item';
                        warningDiv.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i>${warning.message}`;
                        imageWarningsEl.appendChild(warningDiv);
                    });
                }
            }
            
            // Load time
            const loadTimeEl = document.getElementById('metric-load-time');
            const loadTime3GEl = document.getElementById('metric-load-time-3g');
            const loadTime4GEl = document.getElementById('metric-load-time-4g');
            
            if (loadTimeEl) loadTimeEl.textContent = this.formatTime(data.loadTime.average);
            if (loadTime3GEl) loadTime3GEl.textContent = this.formatTime(data.loadTime.fast3g);
            if (loadTime4GEl) loadTime4GEl.textContent = this.formatTime(data.loadTime.fast4g);
            
            // Warnings
            const warningsListEl = document.getElementById('performance-warnings-list');
            if (warningsListEl) {
                warningsListEl.innerHTML = '';
                if (data.warnings.length > 0) {
                    data.warnings.forEach(warning => {
                        const warningDiv = document.createElement('div');
                        warningDiv.className = 'performance-warning-item';
                        warningDiv.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i>${warning.message}`;
                        warningsListEl.appendChild(warningDiv);
                    });
                } else {
                    warningsListEl.innerHTML = '<div class="text-xs text-gray-500 italic">No warnings</div>';
                }
            }
            
            // Suggestions
            const suggestionsListEl = document.getElementById('optimization-suggestions-list');
            if (suggestionsListEl) {
                suggestionsListEl.innerHTML = '';
                if (data.suggestions.length > 0) {
                    data.suggestions.forEach(suggestion => {
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.className = 'performance-suggestion-item';
                        suggestionDiv.innerHTML = `<i class="fas fa-lightbulb mr-1"></i>${suggestion.message}`;
                        suggestionsListEl.appendChild(suggestionDiv);
                    });
                } else {
                    suggestionsListEl.innerHTML = '<div class="text-xs text-gray-500 italic">No suggestions - page is optimized!</div>';
                }
            }
        },
        
        // Render empty state
        renderEmptyMetrics() {
            const scoreEl = document.getElementById('performance-score');
            const scoreBarEl = document.getElementById('performance-score-bar');
            const scoreTextEl = document.getElementById('performance-score-text');
            
            if (scoreEl) scoreEl.textContent = '--';
            if (scoreBarEl) scoreBarEl.style.width = '0%';
            if (scoreTextEl) scoreTextEl.textContent = 'Add blocks to see performance metrics';
        }
    };
    
    // Initialize performance metrics when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Reduced delay since calculation is now much faster
        setTimeout(() => {
            PerformanceMetrics.init();
        }, 500);
    });
    
    // Expose PerformanceMetrics globally
    window.PerformanceMetrics = PerformanceMetrics;
    
    // ==========================================
    // CUSTOM CSS CLASSES HANDLER
    // ==========================================
    // Setup custom CSS classes input handler for a block
    function setupCustomClassesHandler(li) {
        if (!li) return;
        
        const customClassesInput = li.querySelector('.custom-classes-input');
        if (!customClassesInput) return;
        
        const preview = li.querySelector('.block-preview');
        if (!preview) return;
        
        // Get the content input for this block type
        const blockType = preview.getAttribute('data-type');
        if (!blockType) return;
        
        const contentInputSelectors = {
            'divider': '.divider-content-input',
            'spacer': '.spacer-content-input',
            'button': '.button-content-input',
            'video': '.video-content-input',
            'richtext': '.richtext-content-input',
            'image': '.image-content-input',
            'heading': '.heading-content-input',
            'gallery': '.gallery-content-input',
            'code': '.code-content-input',
            'map': '.map-content-input',
            'testimonial': '.testimonial-content-input',
            'hero_section': '.hero-content-input',
            'two_column': '.column-content-input',
            'three_column': '.column-content-input'
        };
        
        const contentInputSelector = contentInputSelectors[blockType];
        if (!contentInputSelector) return;
        
        const contentInput = li.querySelector(contentInputSelector);
        if (!contentInput) return;
        
        // Function to update content with custom classes
        function updateCustomClasses() {
            const customClasses = customClassesInput.value.trim();
            
            // Parse current content
            let content = {};
            try {
                const contentStr = contentInput.value || preview.getAttribute('data-content') || '{}';
                content = typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;
            } catch (e) {
                console.warn('Failed to parse content for custom classes:', e);
                content = {};
            }
            
            // Update custom_classes in content
            if (customClasses) {
                content.custom_classes = customClasses;
            } else {
                delete content.custom_classes;
            }
            
            // Update content input
            contentInput.value = JSON.stringify(content);
            
            // Update preview data attribute
            preview.setAttribute('data-content', JSON.stringify(content));
            
            // Apply classes to preview element
            // Remove old custom classes first
            const oldClasses = preview.getAttribute('data-custom-classes') || '';
            if (oldClasses) {
                oldClasses.split(' ').forEach(cls => {
                    if (cls.trim()) {
                        preview.classList.remove(cls.trim());
                        li.classList.remove(cls.trim());
                    }
                });
            }
            
            // Add new custom classes
            if (customClasses) {
                customClasses.split(' ').forEach(cls => {
                    const trimmedCls = cls.trim();
                    if (trimmedCls) {
                        preview.classList.add(trimmedCls);
                        li.classList.add(trimmedCls);
                    }
                });
                preview.setAttribute('data-custom-classes', customClasses);
            } else {
                preview.removeAttribute('data-custom-classes');
            }
            
            // Refresh preview if function exists
            if (typeof refreshAllPreviews === 'function') {
                setTimeout(() => refreshAllPreviews(), 100);
            }
            
            // Mark as unsaved for auto-save
            if (typeof window.AutoSaveManager !== 'undefined') {
                window.AutoSaveManager.markUnsaved();
            }
        }
        
        // Load existing custom classes from content
        function loadCustomClasses() {
            try {
                const contentStr = contentInput.value || preview.getAttribute('data-content') || '{}';
                const content = typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;
                const customClasses = content.custom_classes || '';
                customClassesInput.value = customClasses;
                
                // Apply classes to preview and li element
                if (customClasses) {
                    customClasses.split(' ').forEach(cls => {
                        const trimmedCls = cls.trim();
                        if (trimmedCls) {
                            preview.classList.add(trimmedCls);
                            li.classList.add(trimmedCls);
                        }
                    });
                    preview.setAttribute('data-custom-classes', customClasses);
                }
            } catch (e) {
                console.warn('Failed to load custom classes:', e);
            }
        }
        
        // Load on init
        loadCustomClasses();
        
        // Listen for changes
        customClassesInput.addEventListener('input', updateCustomClasses);
        customClassesInput.addEventListener('blur', updateCustomClasses);
    }
    
    // Setup custom classes for all existing blocks
    function setupAllCustomClassesHandlers() {
        if (!list) return;
        
        const blocks = list.querySelectorAll('li[data-block-id], li[data-temp-id]');
        blocks.forEach(li => {
            setupCustomClassesHandler(li);
        });
    }
    
    // Initialize custom classes handlers when DOM is ready
    setTimeout(() => {
        setupAllCustomClassesHandlers();
    }, 1000);
    
    // Re-setup when blocks are added dynamically
    if (list) {
        // Observe for new blocks
        const blockObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && (node.matches('li[data-block-id]') || node.matches('li[data-temp-id]'))) {
                        setTimeout(() => {
                            setupCustomClassesHandler(node);
                        }, 100);
                    }
                });
            });
        });
        
        blockObserver.observe(list, {
            childList: true,
            subtree: false
        });
    }
    
    // Initialize existing blocks to have wrappers and width classes
    if (list) {
        const existingBlocks = list.querySelectorAll('li[data-block-id], li[data-temp-id]');
        existingBlocks.forEach(block => {
            const width = block.getAttribute('data-width') || 'full';
            updateBlockWidthClasses(block, width);
        });
    }
});
