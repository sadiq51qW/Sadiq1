// تطبيق دردشة Gemini
document.addEventListener('DOMContentLoaded', function() {
    // المتغيرات العامة
    const API_KEY = 'AIzaSyD0uoEPnN6_FYObDhbMUWYGVxQqFDbRsxE';
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent';
    const chatForm = document.getElementById('chatForm');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const chatMessages = document.getElementById('chatMessages');
    const loadingBar = document.getElementById('loadingBar');
    const fileUploadBtn = document.getElementById('fileUploadBtn');
    const fileInput = document.getElementById('fileInput');
    const attachedFiles = document.getElementById('attachedFiles');
    const dropZone = document.getElementById('dropZone');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewClose = document.getElementById('imagePreviewClose');
    
    // متغيرات لتخزين الملفات المرفقة
    let attachedFilesList = [];
    let messageHistory = [];
    
    // إضافة مستمعي الأحداث
    chatForm.addEventListener('submit', handleSubmit);
    fileUploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    imagePreviewClose.addEventListener('click', closeImagePreview);
    
    // إضافة مستمعي أحداث السحب والإفلات
    document.addEventListener('dragenter', showDropZone);
    document.addEventListener('dragover', preventDefaults);
    document.addEventListener('dragleave', hideDropZoneIfOutside);
    document.addEventListener('drop', handleDrop);
    dropZone.addEventListener('dragover', preventDefaults);
    dropZone.addEventListener('drop', handleDrop);
    
    // منع السلوك الافتراضي لأحداث السحب
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // إظهار منطقة الإفلات
    function showDropZone(e) {
        preventDefaults(e);
        dropZone.classList.add('active');
    }
    
    // إخفاء منطقة الإفلات إذا كان المؤشر خارجها
    function hideDropZoneIfOutside(e) {
        preventDefaults(e);
        // التحقق مما إذا كان المؤشر خارج منطقة الإفلات
        const rect = dropZone.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            dropZone.classList.remove('active');
        }
    }
    
    // معالجة إفلات الملفات
    function handleDrop(e) {
        preventDefaults(e);
        dropZone.classList.remove('active');
        
        const dt = e.dataTransfer;
        const files = dt.files;
        
        handleFiles(files);
    }
    
    // معالجة اختيار الملفات
    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
        // إعادة تعيين قيمة حقل الملف لتمكين اختيار نفس الملف مرة أخرى
        fileInput.value = '';
    }
    
    // معالجة الملفات المختارة
    function handleFiles(files) {
        if (files.length === 0) return;
        
        for (const file of files) {
            // التحقق من حجم الملف (الحد الأقصى 10 ميجابايت)
            if (file.size > 10 * 1024 * 1024) {
                showError(`الملف ${file.name} كبير جدًا. الحد الأقصى هو 10 ميجابايت.`);
                continue;
            }
            
            // إضافة الملف إلى القائمة
            attachedFilesList.push(file);
            
            // إضافة الملف إلى واجهة المستخدم
            const fileElement = document.createElement('div');
            fileElement.className = 'attached-file';
            fileElement.innerHTML = `
                <span class="attached-file-name">${file.name}</span>
                <button class="attached-file-remove" data-index="${attachedFilesList.length - 1}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            attachedFiles.appendChild(fileElement);
            
            // إضافة مستمع حدث لزر الإزالة
            const removeButton = fileElement.querySelector('.attached-file-remove');
            removeButton.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeAttachedFile(index, fileElement);
            });
        }
    }
    
    // إزالة ملف مرفق
    function removeAttachedFile(index, element) {
        attachedFilesList.splice(index, 1);
        element.remove();
        
        // تحديث فهارس الملفات المتبقية
        const removeButtons = document.querySelectorAll('.attached-file-remove');
        for (let i = 0; i < removeButtons.length; i++) {
            removeButtons[i].setAttribute('data-index', i);
        }
    }
    
    // معالجة إرسال النموذج
    async function handleSubmit(e) {
        e.preventDefault();
        
        const message = userInput.value.trim();
        if (message === '' && attachedFilesList.length === 0) return;
        
        // إضافة رسالة المستخدم إلى المحادثة
        addUserMessage(message);
        
        // إظهار مؤشر الكتابة
        showTypingIndicator();
        
        // إظهار شريط التحميل
        loadingBar.classList.add('active');
        
        try {
            // معالجة الملفات المرفقة
            const fileMessages = await processAttachedFiles();
            
            // إرسال الرسالة إلى API
            const response = await sendMessageToAPI(message, fileMessages);
            
            // إضافة رد الروبوت إلى المحادثة
            addBotMessage(response);
        } catch (error) {
            console.error('Error:', error);
            showError('حدث خطأ أثناء الاتصال بـ API. يرجى المحاولة مرة أخرى.');
        } finally {
            // إخفاء مؤشر الكتابة
            hideTypingIndicator();
            
            // إخفاء شريط التحميل
            loadingBar.classList.remove('active');
            
            // مسح حقل الإدخال والملفات المرفقة
            userInput.value = '';
            clearAttachedFiles();
            
            // التركيز على حقل الإدخال
            userInput.focus();
        }
    }
    
    // معالجة الملفات المرفقة
    async function processAttachedFiles() {
        if (attachedFilesList.length === 0) return [];
        
        const fileMessages = [];
        
        for (const file of attachedFilesList) {
            try {
                // قراءة الملف كـ Data URL
                const dataUrl = await readFileAsDataURL(file);
                
                // إضافة الملف إلى المحادثة
                addFileToChat(file, dataUrl);
                
                // إضافة الملف إلى رسائل المستخدم
                if (file.type.startsWith('image/')) {
                    fileMessages.push({
                        type: 'image',
                        name: file.name,
                        dataUrl: dataUrl
                    });
                } else {
                    fileMessages.push({
                        type: 'file',
                        name: file.name,
                        size: formatFileSize(file.size)
                    });
                }
            } catch (error) {
                console.error('Error processing file:', error);
                showError(`فشل في معالجة الملف ${file.name}.`);
            }
        }
        
        return fileMessages;
    }
    
    // قراءة الملف كـ Data URL
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('فشل في قراءة الملف.'));
            reader.readAsDataURL(file);
        });
    }
    
    // إضافة الملف إلى المحادثة
    function addFileToChat(file, dataUrl) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        if (file.type.startsWith('image/')) {
            // إضافة صورة
            messageDiv.innerHTML = `
                <img src="${dataUrl}" alt="${file.name}" class="message-image" data-src="${dataUrl}">
                <div class="message-time">${getCurrentTime()}</div>
            `;
            
            // إضافة مستمع حدث للصورة لفتح المعاينة
            const image = messageDiv.querySelector('.message-image');
            image.addEventListener('click', () => openImagePreview(dataUrl));
        } else {
            // إضافة ملف
            messageDiv.innerHTML = `
                <div class="message-file">
                    <i class="fas ${getFileIcon(file.type)}"></i>
                    <div class="message-file-info">
                        <div class="message-file-name">${file.name}</div>
                        <div class="message-file-size">${formatFileSize(file.size)}</div>
                    </div>
                    <button class="message-file-download" data-url="${dataUrl}" data-name="${file.name}">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
                <div class="message-time">${getCurrentTime()}</div>
            `;
            
            // إضافة مستمع حدث لزر التنزيل
            const downloadButton = messageDiv.querySelector('.message-file-download');
            downloadButton.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                const name = this.getAttribute('data-name');
                downloadFile(url, name);
            });
        }
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // فتح معاينة الصورة
    function openImagePreview(src) {
        imagePreview.src = src;
        imagePreviewContainer.classList.add('active');
    }
    
    // إغلاق معاينة الصورة
    function closeImagePreview() {
        imagePreviewContainer.classList.remove('active');
    }
    
    // تنزيل ملف
    function downloadFile(url, name) {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    // الحصول على أيقونة الملف بناءً على نوعه
    function getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return 'fa-file-image';
        if (fileType.startsWith('video/')) return 'fa-file-video';
        if (fileType.startsWith('audio/')) return 'fa-file-audio';
        if (fileType.startsWith('text/')) return 'fa-file-alt';
        if (fileType.includes('pdf')) return 'fa-file-pdf';
        if (fileType.includes('word') || fileType.includes('document')) return 'fa-file-word';
        if (fileType.includes('excel') || fileType.includes('sheet')) return 'fa-file-excel';
        if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'fa-file-powerpoint';
        if (fileType.includes('zip') || fileType.includes('compressed')) return 'fa-file-archive';
        return 'fa-file';
    }
    
    // تنسيق حجم الملف
    function formatFileSize(size) {
        if (size < 1024) return size + ' بايت';
        if (size < 1024 * 1024) return Math.round(size / 1024) + ' كيلوبايت';
        return Math.round(size / (1024 * 1024) * 10) / 10 + ' ميجابايت';
    }
    
    // مسح الملفات المرفقة
    function clearAttachedFiles() {
        attachedFilesList = [];
        attachedFiles.innerHTML = '';
    }
    
    // إضافة رسالة المستخدم إلى المحادثة
    function addUserMessage(message) {
        if (!message) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message fade-in';
        messageDiv.innerHTML = `
            <p>${message}</p>
            <div class="message-time">${getCurrentTime()}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        
        // إضافة الرسالة إلى سجل المحادثة
        messageHistory.push({
            role: 'user',
            parts: [{ text: message }]
        });
    }
    
    // إضافة رسالة الروبوت إلى المحادثة
    function addBotMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message fade-in';
        
        // تنسيق الرسالة (تحويل الأكواد البرمجية، الروابط، إلخ)
        const formattedMessage = formatMessage(message);
        
        messageDiv.innerHTML = formattedMessage + `<div class="message-time">${getCurrentTime()}</div>`;
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        
        // إضافة الرسالة إلى سجل المحادثة
        messageHistory.push({
            role: 'model',
            parts: [{ text: message }]
        });
        
        // تطبيق تنسيق الأكواد البرمجية
        applyCodeFormatting();
    }
    
    // تنسيق الرسالة
    function formatMessage(message) {
        // تنسيق كتل الأكواد البرمجية
        message = formatCodeBlocks(message);
        
        // تنسيق الأكواد المضمنة
        message = formatInlineCode(message);
        
        // تحويل الروابط إلى عناصر قابلة للنقر
        message = formatLinks(message);
        
        // تنسيق النص العادي
        message = formatTextBlocks(message);
        
        return message;
    }
    
    // تنسيق كتل الأكواد البرمجية
    function formatCodeBlocks(message) {
        // البحث عن كتل الأكواد المحاطة بعلامات ```
        const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
        
        return message.replace(codeBlockRegex, function(match, language, code) {
            // تحديد لغة البرمجة
            const lang = language.toLowerCase() || 'text';
            
            // إنشاء كتلة الكود
            return `
                <div class="code-block-container">
                    <div class="code-block-header">
                        <span class="code-language">${lang}</span>
                        <div class="code-actions">
                            <button class="copy-code-btn" title="نسخ الكود">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="download-code-btn" title="تنزيل الكود">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </div>
                    <pre class="code-block"><code>${escapeHtml(code)}</code></pre>
                </div>
            `;
        });
    }
    
    // تنسيق الأكواد المضمنة
    function formatInlineCode(message) {
        // البحث عن الأكواد المضمنة المحاطة بعلامة `
        const inlineCodeRegex = /`([^`]+)`/g;
        
        return message.replace(inlineCodeRegex, '<span class="inline-code">$1</span>');
    }
    
    // تحويل الروابط إلى عناصر قابلة للنقر
    function formatLinks(message) {
        // البحث عن الروابط
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        return message.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }
    
    // تنسيق النص العادي
    function formatTextBlocks(message) {
        // تقسيم النص إلى فقرات
        const paragraphs = message.split('\n\n');
        
        // تنسيق كل فقرة
        return paragraphs.map(paragraph => {
            // تجاهل الفقرات التي تحتوي على كتل أكواد أو عناصر HTML
            if (paragraph.includes('<div class="code-block-container">') || 
                paragraph.startsWith('<') && paragraph.endsWith('>')) {
                return paragraph;
            }
            
            // تحويل أسطر النص إلى عناصر <p>
            const lines = paragraph.split('\n');
            return lines.map(line => line.trim() ? `<p>${line}</p>` : '').join('');
        }).join('');
    }
    
    // تطبيق تنسيق الأكواد البرمجية
    function applyCodeFormatting() {
        // إضافة مستمعي أحداث لأزرار نسخ الكود
        const copyButtons = document.querySelectorAll('.copy-code-btn');
        copyButtons.forEach(button => {
            button.addEventListener('click', function() {
                const codeBlock = this.closest('.code-block-container').querySelector('code');
                copyToClipboard(codeBlock.textContent);
                
                // إظهار تأكيد النسخ
                this.classList.add('success');
                this.innerHTML = '<i class="fas fa-check"></i>';
                
                // إعادة الزر إلى حالته الأصلية بعد ثانيتين
                setTimeout(() => {
                    this.classList.remove('success');
                    this.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            });
        });
        
        // إضافة مستمعي أحداث لأزرار تنزيل الكود
        const downloadButtons = document.querySelectorAll('.download-code-btn');
        downloadButtons.forEach(button => {
            button.addEventListener('click', function() {
                const codeBlock = this.closest('.code-block-container').querySelector('code');
                const language = this.closest('.code-block-container').querySelector('.code-language').textContent;
                
                // تحديد اسم الملف واللاحقة بناءً على اللغة
                let extension = '.txt';
                if (language === 'javascript' || language === 'js') extension = '.js';
                else if (language === 'python' || language === 'py') extension = '.py';
                else if (language === 'html') extension = '.html';
                else if (language === 'css') extension = '.css';
                else if (language === 'java') extension = '.java';
                else if (language === 'php') extension = '.php';
                else if (language === 'ruby' || language === 'rb') extension = '.rb';
                else if (language === 'go') extension = '.go';
                else if (language === 'rust') extension = '.rs';
                else if (language === 'typescript' || language === 'ts') extension = '.ts';
                else if (language === 'c') extension = '.c';
                else if (language === 'cpp' || language === 'c++') extension = '.cpp';
                else if (language === 'csharp' || language === 'c#') extension = '.cs';
                else if (language === 'swift') extension = '.swift';
                else if (language === 'kotlin') extension = '.kt';
                else if (language === 'sql') extension = '.sql';
                else if (language === 'json') extension = '.json';
                else if (language === 'xml') extension = '.xml';
                else if (language === 'yaml' || language === 'yml') extension = '.yml';
                
                // تنزيل الكود كملف
                downloadText(codeBlock.textContent, 'code' + extension);
                
                // إظهار تأكيد التنزيل
                this.classList.add('success');
                this.innerHTML = '<i class="fas fa-check"></i>';
                
                // إعادة الزر إلى حالته الأصلية بعد ثانيتين
                setTimeout(() => {
                    this.classList.remove('success');
                    this.innerHTML = '<i class="fas fa-download"></i>';
                }, 2000);
            });
        });
    }
    
    // نسخ النص إلى الحافظة
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
    
    // تنزيل النص كملف
    function downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // تهرب من رموز HTML
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // إظهار مؤشر الكتابة
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        
        chatMessages.appendChild(typingDiv);
        scrollToBottom();
    }
    
    // إخفاء مؤشر الكتابة
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    // إظهار رسالة خطأ
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot-message error-message fade-in';
        errorDiv.innerHTML = `
            <p><i class="fas fa-exclamation-circle"></i> ${message}</p>
            <div class="message-time">${getCurrentTime()}</div>
        `;
        
        chatMessages.appendChild(errorDiv);
        scrollToBottom();
    }
    
    // الحصول على الوقت الحالي
    function getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }
    
    // التمرير إلى أسفل المحادثة
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // إرسال الرسالة إلى API
    async function sendMessageToAPI(message, fileMessages = []) {
        // إعداد سجل المحادثة للإرسال
        const history = [...messageHistory];
        
        // إضافة وصف للملفات المرفقة إلى الرسالة
        let fullMessage = message || '';
        
        if (fileMessages.length > 0) {
            if (fullMessage) fullMessage += '\n\n';
            
            fullMessage += 'الملفات المرفقة:\n';
            
            fileMessages.forEach(file => {
                if (file.type === 'image') {
                    fullMessage += `- صورة: ${file.name}\n`;
                } else {
                    fullMessage += `- ملف: ${file.name} (${file.size})\n`;
                }
            });
        }
        
        // إضافة الرسالة الحالية إلى سجل المحادثة
        const currentMessage = {
            role: 'user',
            parts: [{ text: fullMessage }]
        };
        
        // إعداد بيانات الطلب
        const requestData = {
            contents: [...history, currentMessage],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            }
        };
        
        // إرسال الطلب إلى API
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        // التحقق من استجابة API
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        // تحليل الاستجابة
        const data = await response.json();
        
        // استخراج النص من الاستجابة
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('لم يتم العثور على استجابة صالحة من API.');
        }
    }
});
