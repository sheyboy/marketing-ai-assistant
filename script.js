class MarketingAssistant {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.fileButton = document.getElementById('fileButton');
        this.fileInput = document.getElementById('fileInput');
        this.actionButtons = document.querySelectorAll('.action-btn');
        this.selectedFile = null;
        
        // Default webhook URL
        this.defaultWebhookUrl = 'https://n8n2.geekhouse.io/webhook-test/marketing';
        this.webhookUrl = localStorage.getItem('webhookUrl') || this.defaultWebhookUrl;
        
        this.init();
    }

    init() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
        });

        // Quick action buttons
        this.actionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                this.messageInput.value = action;
                this.sendMessage();
            });
        });

        // File upload functionality
        this.fileButton.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        });

        // Settings button
        this.addSettingsButton();
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // Show typing indicator
        this.showTypingIndicator();

        // Disable send button
        this.sendButton.disabled = true;

        try {
            // Send to webhook
            const response = await this.callWebhook(message);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add bot response
            this.addMessage(response, 'bot');
            
        } catch (error) {
            console.error('Error:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        } finally {
            this.sendButton.disabled = false;
        }
    }

    async callWebhook(message) {
        try {
            // Generate a unique chat ID for this session
            const chatId = this.getChatId();
            
            console.log('Sending to webhook:', this.webhookUrl);
            console.log('Chat ID:', chatId);
            console.log('Message:', message);
            
            let response;
            
            if (this.selectedFile) {
                // Handle file upload with FormData
                console.log('Sending file with message:', this.selectedFile);
                
                const formData = new FormData();
                formData.append('file', this.selectedFile);
                formData.append('message', JSON.stringify({
                    chat: { id: chatId },
                    text: message
                }));
                
                response = await fetch(this.webhookUrl, {
                    method: 'POST',
                    body: formData
                });
                
                // Clear selected file after sending
                this.removeFile();
            } else {
                // Regular text message
                const payload = {
                    message: {
                        chat: {
                            id: chatId
                        },
                        text: message
                    }
                };

                console.log('Payload:', JSON.stringify(payload, null, 2));

                response = await fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
            }

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            // Check if response is binary data (image)
            const contentType = response.headers.get('content-type');
            console.log('Response content type:', contentType);
            
            if (contentType && contentType.startsWith('image/')) {
                // Handle direct image response
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                console.log('Created blob URL for image:', imageUrl);
                
                return this.createImageResponse(imageUrl, 'Generated Image');
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            // Handle different response formats from n8n
            let responseData = null;
            
            if (Array.isArray(data) && data.length > 0) {
                // If response is an array, get the first item
                responseData = data[0];
            } else if (typeof data === 'object') {
                // If response is an object
                responseData = data;
            } else {
                // If response is a string or other type
                return await this.cleanMessageWithGemini(data || 'Response received successfully!');
            }
            
            // Check if response contains binary image data
            if (responseData.binary && responseData.mimeType && responseData.mimeType.startsWith('image/')) {
                console.log('Found binary image data in response');
                const imageUrl = `data:${responseData.mimeType};base64,${responseData.binary}`;
                return this.createImageResponse(imageUrl, responseData.fileName || 'Generated Image');
            }
            
            // Check if response contains image file data
            if (responseData.image && typeof responseData.image === 'object') {
                console.log('Found image object in response');
                if (responseData.image.binary && responseData.image.mimeType) {
                    const imageUrl = `data:${responseData.image.mimeType};base64,${responseData.image.binary}`;
                    return this.createImageResponse(imageUrl, responseData.image.fileName || 'Generated Image');
                }
            }
            
            // Check if this is a structured blog/LinkedIn response
            if (responseData.post || responseData.imageUrl || responseData.imageBinary) {
                console.log('Detected structured blog/LinkedIn response');
                return this.formatBlogResponse(responseData);
            }
            
            // Handle text response
            const responseText = responseData.output || responseData.text || responseData.message || JSON.stringify(responseData);
            console.log('Final response text:', responseText);
            
            // Clean up the response using Gemini API
            const cleanedResponse = await this.cleanMessageWithGemini(responseText);
            return cleanedResponse;
            
        } catch (error) {
            console.error('Webhook call failed:', error);
            throw error;
        }
    }

    async cleanMessageWithGemini(message) {
        try {
            console.log('Cleaning message with Gemini:', message);
            
            // First, do basic HTML cleanup
            let cleanedMessage = this.basicHtmlCleanup(message);
            
            const geminiApiKey = 'AIzaSyDPQ6ftpU9fNzoKSmIUnoMwwdD0JGWBP-Q';
            const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
            
            const prompt = `Please clean up this message for a professional chat interface. Remove any HTML tags, JavaScript code, CSS attributes, or technical artifacts. Keep only the meaningful text content and preserve any markdown links in the format [text](url). Make it conversational and user-friendly:

${cleanedMessage}

Return only the cleaned, readable message.`;

            const payload = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            };

            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': geminiApiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error('Gemini API error:', response.status);
                return cleanedMessage; // Return basic cleaned message if API fails
            }

            const data = await response.json();
            const finalMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || cleanedMessage;
            
            console.log('Cleaned message:', finalMessage);
            return finalMessage;
            
        } catch (error) {
            console.error('Error cleaning message with Gemini:', error);
            return this.basicHtmlCleanup(message); // Return basic cleaned message if Gemini fails
        }
    }

    basicHtmlCleanup(message) {
        // Remove HTML tags and attributes
        let cleaned = message
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/alt="[^"]*"/g, '') // Remove alt attributes
            .replace(/class="[^"]*"/g, '') // Remove class attributes
            .replace(/onload="[^"]*"/g, '') // Remove onload attributes
            .replace(/onerror="[^"]*"/g, '') // Remove onerror attributes
            .replace(/target="[^"]*"/g, '') // Remove target attributes
            .replace(/rel="[^"]*"/g, '') // Remove rel attributes
            .replace(/this\.parentElement[^"]*"/g, '') // Remove complex JS
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        
        return cleaned;
    }

    createImageResponse(imageUrl, fileName) {
        // Create a special response format for direct images
        return `Here's your generated image: [${fileName}](${imageUrl})`;
    }

    formatBlogResponse(responseData) {
        console.log('Formatting blog response:', responseData);
        
        let formattedResponse = '';
        
        // Add the main output text if available
        if (responseData.output) {
            formattedResponse += responseData.output + '\n\n';
        }
        
        // Add the blog post content
        if (responseData.post) {
            formattedResponse += responseData.post + '\n\n';
        }
        
        // Add image if available
        if (responseData.imageUrl && responseData.imageTitle) {
            formattedResponse += `[${responseData.imageTitle}](${responseData.imageUrl})`;
        } else if (responseData.imageBinary) {
            // Handle binary image data
            const imageUrl = `data:image/png;base64,${responseData.imageBinary}`;
            const title = responseData.imageTitle || 'Generated Image';
            formattedResponse += `[${title}](${imageUrl})`;
        }
        
        return formattedResponse.trim();
    }

    handleFileSelection(file) {
        console.log('File selected:', file);
        this.selectedFile = file;
        
        // Show file preview in input area
        const reader = new FileReader();
        reader.onload = (e) => {
            this.showFilePreview(file.name, e.target.result);
        };
        reader.readAsDataURL(file);
    }

    showFilePreview(fileName, dataUrl) {
        // Create file preview element
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        preview.innerHTML = `
            <div class="file-preview-content">
                <img src="${dataUrl}" alt="${fileName}" class="preview-image">
                <span class="file-name">${fileName}</span>
                <button class="remove-file" onclick="window.marketingAssistant.removeFile()">×</button>
            </div>
        `;
        
        // Remove existing preview
        const existingPreview = document.querySelector('.file-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        // Add preview before input wrapper
        const inputContainer = document.querySelector('.chat-input-container');
        inputContainer.insertBefore(preview, inputContainer.firstChild);
        
        // Update placeholder
        this.messageInput.placeholder = `Tell Buzzbot what you want to do with ${fileName}...`;
    }

    removeFile() {
        this.selectedFile = null;
        const preview = document.querySelector('.file-preview');
        if (preview) {
            preview.remove();
        }
        this.messageInput.placeholder = "Chat with Buzzbot... (e.g., 'Create a LinkedIn post about digital marketing trends')";
        this.fileInput.value = '';
    }

    getChatId() {
        // Get or create a unique chat ID for this session
        let chatId = localStorage.getItem('chatId');
        if (!chatId) {
            chatId = 'web_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('chatId', chatId);
        }
        return chatId;
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Handle different content types
        if (typeof content === 'string') {
            // Process the content to handle images and links
            let processedContent = this.processMessageContent(content);
            messageContent.innerHTML = processedContent;
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    processMessageContent(content) {
        console.log('Processing message content:', content);
        
        // First, extract markdown-style links [text](url)
        const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
        let processedContent = content;
        
        // Find all markdown links and check if they're images
        const markdownMatches = [...content.matchAll(markdownLinkRegex)];
        console.log('Found markdown matches:', markdownMatches);
        
        for (const match of markdownMatches) {
            const [fullMatch, linkText, url] = match;
            console.log('Processing markdown link:', { fullMatch, linkText, url });
            
            // Check if the URL is an image (common image extensions or contains media/image paths)
            const isImage = this.isImageUrl(url);
            console.log('Is image?', isImage, 'for URL:', url);
            
            if (isImage) {
                // Replace with image tag
                const imageHtml = `
                    <div class="image-container">
                        <img src="${url}" alt="${linkText}" class="chat-image" 
                             onload="this.parentElement.parentElement.parentElement.parentElement.scrollTop = this.parentElement.parentElement.parentElement.parentElement.scrollHeight"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="image-fallback" style="display:none;">
                            <a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>
                        </div>
                        <div class="image-caption">${linkText}</div>
                    </div>
                `;
                console.log('Replacing with image HTML');
                processedContent = processedContent.replace(fullMatch, imageHtml);
            } else {
                // Replace with regular link
                console.log('Replacing with regular link');
                processedContent = processedContent.replace(fullMatch, `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${linkText}</a>`);
            }
        }
        
        // Handle regular URLs that aren't in markdown format
        const urlRegex = /(https?:\/\/[^\s\)]+)/g;
        processedContent = processedContent.replace(urlRegex, (url) => {
            // Skip if this URL is already processed as part of markdown
            if (markdownMatches.some(match => match[2] === url)) {
                return url;
            }
            
            console.log('Processing standalone URL:', url);
            const isImage = this.isImageUrl(url);
            console.log('Standalone URL is image?', isImage);
            
            if (isImage) {
                return `
                    <div class="image-container">
                        <img src="${url}" alt="Generated Image" class="chat-image" 
                             onload="this.parentElement.parentElement.parentElement.parentElement.scrollTop = this.parentElement.parentElement.parentElement.parentElement.scrollHeight"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="image-fallback" style="display:none;">
                            <a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>
                        </div>
                    </div>
                `;
            } else {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>`;
            }
        });
        
        // Add some basic text formatting
        processedContent = this.formatText(processedContent);
        
        console.log('Final processed content:', processedContent);
        return processedContent;
    }

    formatText(content) {
        // Add paragraph breaks for better readability
        let formatted = content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap in paragraph tags if not already wrapped
        if (!formatted.includes('<p>')) {
            formatted = `<p>${formatted}</p>`;
        }
        
        return formatted;
    }

    isImageUrl(url) {
        console.log('Checking if URL is image:', url);
        
        // Check for common image extensions
        const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i;
        const hasImageExtension = imageExtensions.test(url);
        console.log('Has image extension?', hasImageExtension);
        
        // Check for your specific n8n media server patterns
        const n8nMediaPatterns = [
            /n8n2\.geekhouse\.io.*\/media\/user_files\//i,
            /\/media\/user_files\//i
        ];
        
        const isN8nMedia = n8nMediaPatterns.some(pattern => {
            const matches = pattern.test(url);
            console.log('Pattern', pattern, 'matches?', matches);
            return matches;
        });
        console.log('Is n8n media?', isN8nMedia);
        
        // Check for other common image hosting patterns
        const imageHostPatterns = [
            /\/media\/.*\.(jpg|jpeg|png|gif|bmp|webp)/i,
            /\/images?\//i,
            /\/uploads?\//i,
            /image/i
        ];
        
        const hasImageHostPattern = imageHostPatterns.some(pattern => pattern.test(url));
        console.log('Has image host pattern?', hasImageHostPattern);
        
        // First check for your n8n media server (these are always images)
        if (isN8nMedia) {
            console.log('Detected as n8n media image');
            return true;
        }
        
        // Then check for standard image patterns
        const result = hasImageExtension || hasImageHostPattern;
        console.log('Final image detection result:', result);
        return result;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message';
        typingDiv.id = 'typing-indicator';
        
        const typingContent = document.createElement('div');
        typingContent.className = 'typing-indicator';
        typingContent.innerHTML = `
            <span>AI is thinking</span>
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        typingDiv.appendChild(typingContent);
        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    addSettingsButton() {
        const settingsBtn = document.createElement('button');
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.className = 'settings-btn';
        settingsBtn.title = 'Settings';
        settingsBtn.onclick = () => this.showSettings();
        
        document.querySelector('header').appendChild(settingsBtn);
    }

    showSettings() {
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.innerHTML = `
            <div class="settings-content">
                <h2>Settings</h2>
                <div class="setting-item">
                    <label for="webhookUrlInput">Webhook URL:</label>
                    <input type="url" id="webhookUrlInput" value="${this.webhookUrl}" 
                           placeholder="https://your-n8n-instance.com/webhook/...">
                    <small>Default: ${this.defaultWebhookUrl}</small>
                </div>
                <div class="settings-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn-secondary">
                        Cancel
                    </button>
                    <button onclick="window.marketingAssistant.saveSettings()" class="btn-primary">
                        Save
                    </button>
                    <button onclick="window.marketingAssistant.resetToDefault()" class="btn-reset">
                        Reset to Default
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    saveSettings() {
        const newUrl = document.getElementById('webhookUrlInput').value.trim();
        if (newUrl) {
            this.webhookUrl = newUrl;
            localStorage.setItem('webhookUrl', newUrl);
            this.addMessage('Settings saved successfully!', 'bot');
        }
        document.querySelector('.settings-modal').remove();
    }

    resetToDefault() {
        this.webhookUrl = this.defaultWebhookUrl;
        localStorage.removeItem('webhookUrl');
        document.getElementById('webhookUrlInput').value = this.defaultWebhookUrl;
        this.addMessage('Webhook URL reset to default.', 'bot');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.marketingAssistant = new MarketingAssistant();
});