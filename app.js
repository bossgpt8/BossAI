class AIChatApp {
    constructor() {
        this.messages = [];
        this.attachedImages = [];
        this.currentModel = 'amazon/nova-2-lite-v1:free';
        this.isGenerating = false;
        this.conversations = [];
        this.currentConversationId = null;
        this.voiceEnabled = false;
        this.isRecording = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.userId = null;
        this.db = null;
        this.user = null;
        this.flashlightStream = null;
        this.isFlashlightOn = false;
        this.authMode = 'login';
        this.hasShownAuthModal = false;
        
        this.visionModels = [
            'google/gemma-3-12b-it:free',
            'google/gemma-3n-e2b-it:free'
        ];
        
        this.smartCommands = [
            { patterns: ['turn on flashlight', 'torch on', 'flashlight on', 'light on'], action: 'flashlightOn' },
            { patterns: ['turn off flashlight', 'torch off', 'flashlight off', 'light off'], action: 'flashlightOff' },
            { patterns: ['call ', 'phone ', 'dial '], action: 'makeCall' },
            { patterns: ['open whatsapp', 'open wa'], action: 'openWhatsApp' },
            { patterns: ['open youtube', 'open yt'], action: 'openYouTube' },
            { patterns: ['open gmail', 'open email', 'open mail'], action: 'openGmail' },
            { patterns: ['open instagram', 'open ig'], action: 'openInstagram' },
            { patterns: ['open twitter', 'open x'], action: 'openTwitter' },
            { patterns: ['open facebook', 'open fb'], action: 'openFacebook' },
            { patterns: ['open tiktok'], action: 'openTikTok' },
            { patterns: ['open spotify'], action: 'openSpotify' },
            { patterns: ['open maps', 'open google maps'], action: 'openMaps' },
            { patterns: ['search google for', 'google search', 'search for'], action: 'googleSearch' },
            { patterns: ['search youtube for', 'youtube search'], action: 'youtubeSearch' },
            { patterns: ['set timer for', 'timer for', 'set alarm'], action: 'setTimer' },
            { patterns: ['what time is it', 'current time', 'tell me the time'], action: 'tellTime' },
            { patterns: ['what date is it', 'current date', 'today\'s date', 'what day is it'], action: 'tellDate' },
            { patterns: ['what\'s the weather', 'weather today', 'how\'s the weather'], action: 'getWeather' },
            { patterns: ['open camera'], action: 'openCamera' },
            { patterns: ['take a screenshot', 'screenshot'], action: 'takeScreenshot' },
            { patterns: ['share this', 'share chat'], action: 'shareChat' },
            { patterns: ['read this page', 'read aloud'], action: 'readPage' },
            { patterns: ['stop reading', 'stop speaking', 'be quiet', 'shut up'], action: 'stopSpeaking' },
            { patterns: ['who are you', 'what are you', 'introduce yourself'], action: 'introduce' },
            { patterns: ['tell me a joke', 'make me laugh', 'say something funny'], action: 'tellJoke' },
            { patterns: ['motivate me', 'inspire me', 'give me motivation'], action: 'motivate' },
            { patterns: ['good morning', 'good afternoon', 'good evening', 'good night'], action: 'greet' },
            { patterns: ['how are you', 'how do you feel', 'are you okay'], action: 'howAreYou' },
            { patterns: ['thank you', 'thanks', 'thank u'], action: 'thankYou' },
            { patterns: ['i love you', 'love you'], action: 'loveResponse' },
            { patterns: ['i\'m sad', 'i feel sad', 'i\'m depressed', 'feeling down'], action: 'cheerUp' },
            { patterns: ['i\'m bored', 'i am bored', 'nothing to do'], action: 'bored' },
            { patterns: ['help me study', 'study tips', 'how to study'], action: 'studyTips' },
            { patterns: ['battery level', 'battery status', 'how much battery'], action: 'batteryStatus' },
        ];
        
        this.initFirebase();
        this.initElements();
        this.initEventListeners();
        this.initSpeechRecognition();
        this.loadConversations();
        this.checkApiStatus();
    }
    
    async initFirebase() {
        try {
            const response = await fetch('/api/firebase-config');
            const config = await response.json();
            
            if (config.configured && config.config) {
                if (!firebase.apps.length) {
                    firebase.initializeApp(config.config);
                }
                this.db = firebase.firestore();
                this.firebaseReady = true;
                
                firebase.auth().onAuthStateChanged((user) => {
                    if (user) {
                        this.user = user;
                        this.userId = user.uid;
                        this.updateAuthUI(true);
                        this.loadConversationsFromFirebase();
                    } else {
                        this.user = null;
                        this.userId = null;
                        this.updateAuthUI(false);
                        this.loadConversations();
                        this.showAuthModalOnFirstVisit();
                    }
                });
            } else {
                console.log('Firebase not configured, using localStorage');
                this.firebaseReady = false;
                this.hideAuthButton();
                this.loadConversations();
                this.showLocalStorageNotice();
            }
        } catch (error) {
            console.log('Firebase init failed, using localStorage');
            this.firebaseReady = false;
            this.hideAuthButton();
            this.loadConversations();
            this.showLocalStorageNotice();
        }
    }
    
    showLocalStorageNotice() {
        const hasSeenNotice = localStorage.getItem('local_storage_notice_seen');
        if (!hasSeenNotice) {
            setTimeout(() => {
                this.showNotification('Your chats are saved locally on this device. Sign in to sync across devices!', 'info', 5000);
                localStorage.setItem('local_storage_notice_seen', 'true');
            }, 2000);
        }
    }
    
    hideAuthButton() {
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            authBtn.style.display = 'none';
        }
    }
    
    updateAuthUI(isLoggedIn) {
        const authBtn = document.getElementById('authBtn');
        const userInfo = document.getElementById('userInfo');
        
        if (isLoggedIn && this.user) {
            if (authBtn) authBtn.style.display = 'none';
            if (userInfo) {
                userInfo.style.display = 'flex';
                userInfo.innerHTML = `
                    <img src="${this.user.photoURL || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👤</text></svg>'}" alt="User" class="user-avatar">
                    <span class="user-name">${this.user.displayName || 'User'}</span>
                    <button class="logout-btn" onclick="app.signOut()">Sign Out</button>
                `;
            }
        } else {
            if (authBtn) authBtn.style.display = 'flex';
            if (userInfo) userInfo.style.display = 'none';
        }
    }
    
    async signInWithGoogle() {
        if (!this.firebaseReady) {
            this.showNotification('Sign-in not available. Firebase not configured.', 'warning');
            return;
        }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithPopup(provider);
            this.showNotification('Signed in successfully!', 'success');
        } catch (error) {
            console.error('Sign in error:', error);
            this.showNotification('Sign in failed: ' + error.message, 'error');
        }
    }
    
    async signOut() {
        try {
            await firebase.auth().signOut();
            this.conversations = [];
            this.loadConversations();
            this.showNotification('Signed out successfully', 'info');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }
    
    openAuthModal() {
        if (!this.firebaseReady) {
            this.showNotification('Authentication not available. Firebase not configured.', 'warning');
            return;
        }
        this.authModal.style.display = 'flex';
        this.authModal.classList.remove('hidden');
        this.switchAuthMode('login');
        this.clearAuthError();
    }
    
    closeAuthModalFn() {
        this.authModal.style.display = 'none';
        this.authModal.classList.add('hidden');
        this.clearAuthForm();
    }
    
    skipAuthentication() {
        this.closeAuthModalFn();
        localStorage.setItem('auth_skipped', 'true');
        this.showNotification('Continuing without sign in. Your chats will be saved locally.', 'info');
    }
    
    switchAuthMode(mode) {
        this.authMode = mode;
        this.clearAuthError();
        
        if (mode === 'login') {
            this.loginTab.classList.add('bg-white', 'text-black');
            this.loginTab.classList.remove('text-dark-400');
            this.signupTab.classList.remove('bg-white', 'text-black');
            this.signupTab.classList.add('text-dark-400');
            this.nameField.classList.add('hidden');
            this.confirmPasswordField.classList.add('hidden');
            this.authTitle.textContent = 'Welcome back';
            this.authSubtitle.textContent = 'Sign in to continue to BossAI';
            this.authSubmitText.textContent = 'Continue';
        } else {
            this.signupTab.classList.add('bg-white', 'text-black');
            this.signupTab.classList.remove('text-dark-400');
            this.loginTab.classList.remove('bg-white', 'text-black');
            this.loginTab.classList.add('text-dark-400');
            this.nameField.classList.remove('hidden');
            this.confirmPasswordField.classList.remove('hidden');
            this.authTitle.textContent = 'Create your account';
            this.authSubtitle.textContent = 'Sign up to sync your chats across devices';
            this.authSubmitText.textContent = 'Create account';
        }
    }
    
    togglePasswordVisibility() {
        const type = this.authPassword.type === 'password' ? 'text' : 'password';
        this.authPassword.type = type;
        if (this.authConfirmPassword) {
            this.authConfirmPassword.type = type;
        }
    }
    
    showAuthError(message) {
        this.authError.textContent = message;
        this.authError.classList.remove('hidden');
    }
    
    clearAuthError() {
        this.authError.textContent = '';
        this.authError.classList.add('hidden');
    }
    
    clearAuthForm() {
        if (this.authEmail) this.authEmail.value = '';
        if (this.authPassword) this.authPassword.value = '';
        if (this.authConfirmPassword) this.authConfirmPassword.value = '';
        if (this.authName) this.authName.value = '';
        this.clearAuthError();
    }
    
    setAuthLoading(loading) {
        if (loading) {
            this.authSubmitText.classList.add('hidden');
            this.authSubmitLoader.classList.remove('hidden');
            this.authSubmit.disabled = true;
        } else {
            this.authSubmitText.classList.remove('hidden');
            this.authSubmitLoader.classList.add('hidden');
            this.authSubmit.disabled = false;
        }
    }
    
    async handleAuthSubmit(e) {
        e.preventDefault();
        
        const email = this.authEmail.value.trim();
        const password = this.authPassword.value;
        
        if (!email || !password) {
            this.showAuthError('Please fill in all required fields');
            return;
        }
        
        if (this.authMode === 'signup') {
            const name = this.authName.value.trim();
            const confirmPassword = this.authConfirmPassword.value;
            
            if (password !== confirmPassword) {
                this.showAuthError('Passwords do not match');
                return;
            }
            
            if (password.length < 6) {
                this.showAuthError('Password must be at least 6 characters');
                return;
            }
            
            await this.signUpWithEmail(email, password, name);
        } else {
            await this.signInWithEmail(email, password);
        }
    }
    
    async signUpWithEmail(email, password, name) {
        this.setAuthLoading(true);
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            
            if (name) {
                await userCredential.user.updateProfile({ displayName: name });
            }
            
            await this.db.collection('users').doc(userCredential.user.uid).set({
                email: email,
                displayName: name || email.split('@')[0],
                createdAt: Date.now()
            }, { merge: true });
            
            this.closeAuthModalFn();
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            console.error('Sign up error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error.code));
        } finally {
            this.setAuthLoading(false);
        }
    }
    
    async signInWithEmail(email, password) {
        this.setAuthLoading(true);
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            this.closeAuthModalFn();
            this.showNotification('Signed in successfully!', 'success');
        } catch (error) {
            console.error('Sign in error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error.code));
        } finally {
            this.setAuthLoading(false);
        }
    }
    
    getFirebaseErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'Email/password sign in is not enabled.',
            'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-credential': 'Invalid email or password. Please try again.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/popup-closed-by-user': 'Sign in was cancelled.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };
        return messages[code] || 'An error occurred. Please try again.';
    }
    
    showAuthModalOnFirstVisit() {
        const hasSkipped = localStorage.getItem('auth_skipped');
        if (!this.user && !hasSkipped && !this.hasShownAuthModal && this.firebaseReady) {
            this.hasShownAuthModal = true;
            setTimeout(() => {
                this.showNotification('Sign in to sync your chat history across all devices!', 'info', 5000);
                setTimeout(() => {
                    this.openAuthModal();
                }, 1000);
            }, 1500);
        }
    }
    
    initElements() {
        this.messagesArea = document.getElementById('messagesArea');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.attachBtn = document.getElementById('attachBtn');
        this.imageInput = document.getElementById('imageInput');
        this.imagePreviewContainer = document.getElementById('imagePreviewContainer');
        this.modelSelect = document.getElementById('modelSelect');
        this.modelBadge = document.getElementById('modelBadge');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.conversationList = document.getElementById('conversationList');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.sidebar = document.getElementById('sidebar');
        this.mobileMenuBtn = document.getElementById('mobileMenuBtn');
        this.overlay = document.getElementById('overlay');
        this.voiceToggle = document.getElementById('voiceToggle');
        this.micBtn = document.getElementById('micBtn');
        this.generateImageBtn = document.getElementById('generateImageBtn');
        this.imageGenModal = document.getElementById('imageGenModal');
        this.imagePrompt = document.getElementById('imagePrompt');
        this.closeImageModal = document.getElementById('closeImageModal');
        this.cancelImageGen = document.getElementById('cancelImageGen');
        this.confirmImageGen = document.getElementById('confirmImageGen');
        this.authBtn = document.getElementById('authBtn');
        
        this.authModal = document.getElementById('authModal');
        this.authForm = document.getElementById('authForm');
        this.authEmail = document.getElementById('authEmail');
        this.authPassword = document.getElementById('authPassword');
        this.authConfirmPassword = document.getElementById('authConfirmPassword');
        this.authName = document.getElementById('authName');
        this.authError = document.getElementById('authError');
        this.authSubmit = document.getElementById('authSubmit');
        this.authSubmitText = document.getElementById('authSubmitText');
        this.authSubmitLoader = document.getElementById('authSubmitLoader');
        this.loginTab = document.getElementById('loginTab');
        this.signupTab = document.getElementById('signupTab');
        this.nameField = document.getElementById('nameField');
        this.confirmPasswordField = document.getElementById('confirmPasswordField');
        this.togglePassword = document.getElementById('togglePassword');
        this.googleSignInBtn = document.getElementById('googleSignInBtn');
        this.closeAuthModal = document.getElementById('closeAuthModal');
        this.skipAuth = document.getElementById('skipAuth');
        this.authTitle = document.getElementById('authTitle');
        this.authSubtitle = document.getElementById('authSubtitle');
    }
    
    initEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.messageInput.addEventListener('input', () => {
            this.autoResize();
            this.updateSendButton();
        });
        
        this.modelSelect.addEventListener('change', (e) => {
            this.currentModel = e.target.value;
            this.updateModelBadge();
        });
        
        this.newChatBtn.addEventListener('click', () => this.newChat());
        
        this.attachBtn.addEventListener('click', () => {
            if (!this.isVisionCapable()) {
                this.showNotification('Please select Gemini-12b or Gemini-e2b Scout to attach images', 'warning');
                return;
            }
            this.imageInput.click();
        });
        
        this.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                this.messageInput.value = prompt;
                this.autoResize();
                this.updateSendButton();
                this.messageInput.focus();
            });
        });
        
        this.mobileMenuBtn.addEventListener('click', () => this.toggleSidebar());
        this.overlay.addEventListener('click', () => this.closeSidebar());
        
        this.voiceToggle.addEventListener('click', () => {
            this.voiceEnabled = !this.voiceEnabled;
            this.voiceToggle.classList.toggle('active', this.voiceEnabled);
            this.showNotification(this.voiceEnabled ? 'Voice responses enabled' : 'Voice responses disabled', 'info');
        });
        
        this.micBtn.addEventListener('click', () => this.toggleRecording());
        
        this.generateImageBtn.addEventListener('click', () => this.openImageGenModal());
        this.closeImageModal.addEventListener('click', () => this.closeImageGenModal());
        this.cancelImageGen.addEventListener('click', () => this.closeImageGenModal());
        this.confirmImageGen.addEventListener('click', () => this.generateImage());
        
        this.imageGenModal.addEventListener('click', (e) => {
            if (e.target === this.imageGenModal) {
                this.closeImageGenModal();
            }
        });
        
        if (this.authBtn) {
            this.authBtn.addEventListener('click', () => this.openAuthModal());
        }
        
        if (this.loginTab) {
            this.loginTab.addEventListener('click', () => this.switchAuthMode('login'));
        }
        if (this.signupTab) {
            this.signupTab.addEventListener('click', () => this.switchAuthMode('signup'));
        }
        if (this.authForm) {
            this.authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));
        }
        if (this.togglePassword) {
            this.togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
        }
        if (this.googleSignInBtn) {
            this.googleSignInBtn.addEventListener('click', () => this.signInWithGoogle());
        }
        if (this.closeAuthModal) {
            this.closeAuthModal.addEventListener('click', () => this.closeAuthModalFn());
        }
        if (this.skipAuth) {
            this.skipAuth.addEventListener('click', () => this.skipAuthentication());
        }
        if (this.authModal) {
            this.authModal.addEventListener('click', (e) => {
                if (e.target === this.authModal) {
                    this.closeAuthModalFn();
                }
            });
        }
    }
    
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.isRecording = true;
                this.micBtn.classList.add('recording');
                this.showNotification('Listening...', 'info');
            };
            
            this.recognition.onend = () => {
                this.isRecording = false;
                this.micBtn.classList.remove('recording');
            };
            
            this.recognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                this.messageInput.value = transcript;
                this.autoResize();
                this.updateSendButton();
                
                if (event.results[event.resultIndex].isFinal) {
                    setTimeout(() => this.sendMessage(), 500);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                this.micBtn.classList.remove('recording');
                if (event.error === 'not-allowed') {
                    this.showNotification('Microphone access denied. Please allow microphone access.', 'error');
                }
            };
        } else {
            this.micBtn.style.display = 'none';
        }
    }
    
    toggleRecording() {
        if (!this.recognition) {
            this.showNotification('Speech recognition not supported in this browser', 'error');
            return;
        }
        
        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }
    
    speak(text) {
        if (!this.synthesis) return;
        
        this.synthesis.cancel();
        
        const cleanText = text
            .replace(/```[\s\S]*?```/g, 'code block')
            .replace(/`[^`]+`/g, 'code')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[#*_~]/g, '')
            .replace(/\n+/g, '. ')
            .replace(/<[^>]*>/g, '');
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural')) || voices[0];
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        this.synthesis.speak(utterance);
    }
    
    checkSmartCommand(input) {
        const lowerInput = input.toLowerCase().trim();
        
        for (const cmd of this.smartCommands) {
            for (const pattern of cmd.patterns) {
                if (lowerInput.includes(pattern) || lowerInput.startsWith(pattern)) {
                    return { action: cmd.action, input: lowerInput, pattern };
                }
            }
        }
        return null;
    }
    
    async executeSmartCommand(command) {
        const { action, input, pattern } = command;
        let response = '';
        
        switch (action) {
            case 'flashlightOn':
                response = await this.toggleFlashlight(true);
                break;
            case 'flashlightOff':
                response = await this.toggleFlashlight(false);
                break;
            case 'makeCall':
                const phoneNumber = input.replace(pattern, '').trim();
                if (phoneNumber) {
                    window.open(`tel:${phoneNumber}`, '_self');
                    response = `Opening phone to call ${phoneNumber}...`;
                } else {
                    response = "Please specify a phone number. For example: 'Call 08012345678'";
                }
                break;
            case 'openWhatsApp':
                window.open('https://wa.me/', '_blank');
                response = "Opening WhatsApp...";
                break;
            case 'openYouTube':
                window.open('https://youtube.com', '_blank');
                response = "Opening YouTube...";
                break;
            case 'openGmail':
                window.open('https://mail.google.com', '_blank');
                response = "Opening Gmail...";
                break;
            case 'openInstagram':
                window.open('https://instagram.com', '_blank');
                response = "Opening Instagram...";
                break;
            case 'openTwitter':
                window.open('https://twitter.com', '_blank');
                response = "Opening Twitter/X...";
                break;
            case 'openFacebook':
                window.open('https://facebook.com', '_blank');
                response = "Opening Facebook...";
                break;
            case 'openTikTok':
                window.open('https://tiktok.com', '_blank');
                response = "Opening TikTok...";
                break;
            case 'openSpotify':
                window.open('https://open.spotify.com', '_blank');
                response = "Opening Spotify...";
                break;
            case 'openMaps':
                window.open('https://maps.google.com', '_blank');
                response = "Opening Google Maps...";
                break;
            case 'googleSearch':
                const searchQuery = input.replace(/search google for|google search|search for/gi, '').trim();
                if (searchQuery) {
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
                    response = `Searching Google for "${searchQuery}"...`;
                } else {
                    response = "What would you like me to search for?";
                }
                break;
            case 'youtubeSearch':
                const ytQuery = input.replace(/search youtube for|youtube search/gi, '').trim();
                if (ytQuery) {
                    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`, '_blank');
                    response = `Searching YouTube for "${ytQuery}"...`;
                } else {
                    response = "What would you like to find on YouTube?";
                }
                break;
            case 'setTimer':
                const timeMatch = input.match(/(\d+)\s*(minute|min|second|sec|hour|hr)/i);
                if (timeMatch) {
                    const amount = parseInt(timeMatch[1]);
                    const unit = timeMatch[2].toLowerCase();
                    let ms = amount * 1000;
                    if (unit.includes('min')) ms *= 60;
                    if (unit.includes('hour') || unit.includes('hr')) ms *= 3600;
                    
                    setTimeout(() => {
                        this.showNotification(`Timer: ${amount} ${unit}(s) is up!`, 'warning');
                        this.speak(`Your timer for ${amount} ${unit}s is complete!`);
                        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 200]);
                    }, ms);
                    response = `Timer set for ${amount} ${unit}(s). I'll notify you when it's done!`;
                } else {
                    response = "Please specify a time. For example: 'Set timer for 5 minutes'";
                }
                break;
            case 'tellTime':
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                response = `The current time is ${timeStr}.`;
                break;
            case 'tellDate':
                const today = new Date();
                const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                response = `Today is ${dateStr}.`;
                break;
            case 'getWeather':
                response = "I'll get the weather for you. Please allow location access if prompted.";
                this.getWeatherInfo();
                break;
            case 'openCamera':
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    stream.getTracks().forEach(track => track.stop());
                    this.imageInput.click();
                    response = "Camera access granted. You can now take or select a photo.";
                } catch (e) {
                    response = "Unable to access camera. Please check your permissions.";
                }
                break;
            case 'shareChat':
                if (navigator.share) {
                    const lastMessages = this.messages.slice(-4).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : 'Image message'}`).join('\n\n');
                    navigator.share({ title: 'BossAI', text: lastMessages });
                    response = "Opening share dialog...";
                } else {
                    response = "Sharing is not supported on this browser.";
                }
                break;
            case 'stopSpeaking':
                this.synthesis.cancel();
                response = "Okay, I'll stop talking.";
                break;
            case 'introduce':
                response = "Hi! I'm BossAI, your intelligent assistant. I can help you learn, answer questions, analyze images, generate artwork, and even control some features on your device like the flashlight! I'm here to help you with anything you need. What would you like to explore today?";
                break;
            case 'tellJoke':
                const jokes = [
                    "Why don't scientists trust atoms? Because they make up everything! 😄",
                    "Why did the student eat his homework? Because his teacher told him it was a piece of cake! 📚",
                    "What do you call a fake noodle? An impasta! 🍝",
                    "Why don't eggs tell jokes? They'd crack each other up! 🥚",
                    "What's the best thing about Switzerland? I don't know, but the flag is a big plus! 🇨🇭"
                ];
                response = jokes[Math.floor(Math.random() * jokes.length)];
                break;
            case 'motivate':
                const motivations = [
                    "You've got this! Every expert was once a beginner. Keep pushing forward! 💪",
                    "Success is not final, failure is not fatal. It's the courage to continue that counts. 🌟",
                    "Your potential is endless. Go do what you were created to do! 🚀",
                    "Believe in yourself! You are braver than you believe, stronger than you seem, and smarter than you think. ✨",
                    "The only way to do great work is to love what you do. Keep going! 💯"
                ];
                response = motivations[Math.floor(Math.random() * motivations.length)];
                break;
            case 'greet':
                const hour = new Date().getHours();
                let greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
                response = `${greeting}! How can I help you today? 😊`;
                break;
            case 'howAreYou':
                response = "I'm doing great, thank you for asking! I'm always happy when I get to help someone learn. How are you feeling today?";
                break;
            case 'thankYou':
                const thankResponses = [
                    "You're welcome! Happy to help! 😊",
                    "My pleasure! Let me know if you need anything else.",
                    "Anytime! That's what I'm here for! 🌟",
                    "You're very welcome! Keep up the great work!"
                ];
                response = thankResponses[Math.floor(Math.random() * thankResponses.length)];
                break;
            case 'loveResponse':
                response = "Aww, that's so sweet! I appreciate you too! Let's keep learning together! 💖";
                break;
            case 'cheerUp':
                response = "I'm sorry you're feeling down. Remember, it's okay to have tough days. You're stronger than you know, and this feeling is temporary. Would you like me to tell you a joke, or maybe we can study something interesting together to take your mind off things? I'm here for you! 💙";
                break;
            case 'bored':
                const boredSuggestions = [
                    "How about I quiz you on some fun facts? 🧠",
                    "Let me tell you an interesting science fact!",
                    "Want me to generate a cool image for you?",
                    "How about we explore a new topic together?",
                    "Let's play 20 questions! Think of something and I'll try to guess it."
                ];
                response = "Bored? Let's fix that! " + boredSuggestions[Math.floor(Math.random() * boredSuggestions.length)];
                break;
            case 'studyTips':
                response = "Here are my top study tips:\n\n📚 **Pomodoro Technique**: Study for 25 minutes, then take a 5-minute break.\n\n✍️ **Active Recall**: Test yourself instead of just re-reading.\n\n🗓️ **Spaced Repetition**: Review material at increasing intervals.\n\n🎯 **Set Clear Goals**: Know what you want to achieve each session.\n\n😴 **Get Enough Sleep**: Your brain consolidates memories during sleep!\n\nWant me to help you study a specific subject?";
                break;
            case 'batteryStatus':
                if ('getBattery' in navigator) {
                    const battery = await navigator.getBattery();
                    const level = Math.round(battery.level * 100);
                    const charging = battery.charging ? "and charging" : "not charging";
                    response = `Your battery is at ${level}% ${charging}.`;
                } else {
                    response = "Battery status is not available on this device.";
                }
                break;
            default:
                return null;
        }
        
        return response;
    }
    
    async toggleFlashlight(turnOn) {
        try {
            if (turnOn) {
                if (!this.flashlightStream) {
                    this.flashlightStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' }
                    });
                    const track = this.flashlightStream.getVideoTracks()[0];
                    await track.applyConstraints({ advanced: [{ torch: true }] });
                    this.isFlashlightOn = true;
                    return "Flashlight turned on! 🔦";
                }
            } else {
                if (this.flashlightStream) {
                    this.flashlightStream.getTracks().forEach(track => track.stop());
                    this.flashlightStream = null;
                    this.isFlashlightOn = false;
                    return "Flashlight turned off.";
                }
            }
            return turnOn ? "Flashlight is already on." : "Flashlight is already off.";
        } catch (error) {
            console.error('Flashlight error:', error);
            return "Sorry, I couldn't control the flashlight. This feature works best on mobile devices with a camera flash.";
        }
    }
    
    async getWeatherInfo() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                    const data = await response.json();
                    const weather = data.current_weather;
                    const temp = weather.temperature;
                    const weatherMsg = `The current temperature is ${temp}°C. `;
                    
                    this.addMessageToUI('assistant', weatherMsg);
                    this.messages.push({ role: 'assistant', content: weatherMsg });
                    if (this.voiceEnabled) this.speak(weatherMsg);
                } catch (e) {
                    this.addMessageToUI('assistant', "I couldn't fetch the weather data. Please try again later.");
                }
            }, () => {
                this.addMessageToUI('assistant', "Location access was denied. I need your location to get weather information.");
            });
        }
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 14px 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#667eea'};
            color: white;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 300px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    openImageGenModal() {
        this.imageGenModal.classList.add('show');
        this.imageGenModal.classList.remove('hidden');
        this.imagePrompt.focus();
    }
    
    closeImageGenModal() {
        this.imageGenModal.classList.remove('show');
        this.imageGenModal.classList.add('hidden');
        this.imagePrompt.value = '';
    }
    
    async generateImage() {
        const prompt = this.imagePrompt.value.trim();
        if (!prompt) {
            this.showNotification('Please enter an image description', 'warning');
            return;
        }
        
        const btnText = this.confirmImageGen.querySelector('.btn-text');
        const btnLoader = this.confirmImageGen.querySelector('.btn-loader');
        
        this.confirmImageGen.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'block';
        
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.closeImageGenModal();
            
            this.hideWelcome();
            
            this.addMessageToUI('user', `Generate an image: ${prompt}`);
            this.messages.push({ role: 'user', content: `Generate an image: ${prompt}` });
            
            const imageHtml = `<p>Here's your generated image:</p><img src="${data.imageUrl}" alt="${prompt}" class="generated-image">`;
            this.addMessageToUI('assistant', imageHtml, [], true);
            this.messages.push({ role: 'assistant', content: imageHtml });
            
            this.saveConversation();
            
        } catch (error) {
            this.showNotification(error.message || 'Failed to generate image', 'error');
        } finally {
            this.confirmImageGen.disabled = false;
            btnText.style.display = 'block';
            btnLoader.style.display = 'none';
        }
    }
    
    toggleSidebar() {
        this.sidebar.classList.toggle('open');
        this.sidebar.classList.toggle('translate-x-0');
        this.sidebar.classList.toggle('-translate-x-full');
        this.overlay.classList.toggle('hidden');
    }
    
    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.sidebar.classList.remove('translate-x-0');
        this.sidebar.classList.add('-translate-x-full');
        this.overlay.classList.add('hidden');
    }
    
    async checkApiStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (!this.statusIndicator) return;
            
            const statusDot = this.statusIndicator.querySelector('.status-dot');
            const statusText = this.statusIndicator.querySelector('.status-text');
            
            if (!statusDot || !statusText) return;
            
            this.statusIndicator.classList.add('status-indicator');
            this.statusIndicator.classList.remove('ready', 'error');
            
            if (data.configured) {
                this.statusIndicator.classList.add('ready');
                statusDot.style.background = '#10b981';
                statusDot.style.animation = 'none';
                statusText.textContent = 'Ready';
                statusText.style.color = '#10b981';
            } else {
                this.statusIndicator.classList.add('error');
                statusDot.style.background = '#ef4444';
                statusDot.style.animation = 'none';
                statusText.textContent = 'API Key Missing';
                statusText.style.color = '#ef4444';
            }
        } catch (error) {
            if (!this.statusIndicator) return;
            
            const statusDot = this.statusIndicator.querySelector('.status-dot');
            const statusText = this.statusIndicator.querySelector('.status-text');
            
            if (!statusDot || !statusText) return;
            
            this.statusIndicator.classList.add('status-indicator', 'error');
            statusDot.style.background = '#ef4444';
            statusDot.style.animation = 'none';
            statusText.textContent = 'Connection Error';
            statusText.style.color = '#ef4444';
        }
    }
    
    isVisionCapable() {
        return this.visionModels.includes(this.currentModel);
    }
    
    handleImageSelect(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.attachedImages.push({
                        data: event.target.result,
                        type: file.type
                    });
                    this.renderImagePreviews();
                    this.updateSendButton();
                };
                reader.readAsDataURL(file);
            }
        });
        this.imageInput.value = '';
    }
    
    renderImagePreviews() {
        this.imagePreviewContainer.innerHTML = this.attachedImages.map((img, index) => `
            <div class="image-preview">
                <img src="${img.data}" alt="Preview">
                <button class="remove-btn" onclick="app.removeImage(${index})">&times;</button>
            </div>
        `).join('');
    }
    
    removeImage(index) {
        this.attachedImages.splice(index, 1);
        this.renderImagePreviews();
        this.updateSendButton();
    }
    
    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
    }
    
    updateSendButton() {
        const hasContent = this.messageInput.value.trim().length > 0 || this.attachedImages.length > 0;
        this.sendBtn.disabled = !hasContent || this.isGenerating;
    }
    
    updateModelBadge() {
        const modelNames = {
            'amazon/nova-2-lite-v1:free': 'Nova',
            'deepseek/deepseek-chat:free': 'DeepSeek V3',
            'qwen/qwen3-32b:free': 'Qwen3 32B',
            'meta-llama/llama-3.3-70b-instruct:free': 'Llama',
            'mistralai/mistral-small-3.1-24b-instruct:free': 'Mistral',
            'google/gemma-3-12b-it:free': 'Gemma-12b',
            'google/gemma-3n-e2b-it:free': 'Gemma-e2b'
        };
        this.modelBadge.textContent = modelNames[this.currentModel] || 'AI';
    }
    
    async sendMessage() {
        const content = this.messageInput.value.trim();
        const images = [...this.attachedImages];
        
        if ((!content && images.length === 0) || this.isGenerating) return;
        
        const smartCommand = this.checkSmartCommand(content);
        if (smartCommand) {
            this.hideWelcome();
            this.addMessageToUI('user', content, images);
            this.messages.push({ role: 'user', content: content });
            
            this.messageInput.value = '';
            this.autoResize();
            this.updateSendButton();
            
            const response = await this.executeSmartCommand(smartCommand);
            if (response) {
                this.addMessageToUI('assistant', response);
                this.messages.push({ role: 'assistant', content: response });
                if (this.voiceEnabled) this.speak(response);
                this.saveConversation();
                return;
            }
        }
        
        if (content.toLowerCase().startsWith('generate image') || content.toLowerCase().startsWith('create image') || content.toLowerCase().startsWith('make image')) {
            const prompt = content.replace(/^(generate|create|make)\s+image\s+(of\s+)?/i, '');
            if (prompt) {
                this.imagePrompt.value = prompt;
                this.generateImage();
                this.messageInput.value = '';
                return;
            }
        }
        
        this.hideWelcome();
        
        const userMessage = this.createUserMessage(content, images);
        this.messages.push(userMessage);
        this.addMessageToUI('user', content, images);
        
        this.messageInput.value = '';
        this.attachedImages = [];
        this.imagePreviewContainer.innerHTML = '';
        this.autoResize();
        this.updateSendButton();
        
        this.isGenerating = true;
        this.updateSendButton();
        
        const typingIndicator = this.addTypingIndicator();
        
        try {
            const apiMessages = this.formatMessagesForAPI();
            const response = await this.callAPI(apiMessages);
            
            typingIndicator.remove();
            
            this.messages.push({ role: 'assistant', content: response });
            this.addMessageToUI('assistant', response);
            
            if (this.voiceEnabled) {
                this.speak(response);
            }
            
            this.saveConversation();
        } catch (error) {
            typingIndicator.remove();
            this.addErrorMessage(error.message);
        } finally {
            this.isGenerating = false;
            this.updateSendButton();
        }
    }
    
    createUserMessage(content, images) {
        if (images.length > 0) {
            const contentParts = [];
            
            if (content) {
                contentParts.push({
                    type: 'text',
                    text: content
                });
            } else {
                contentParts.push({
                    type: 'text',
                    text: 'What is in this image?'
                });
            }
            
            images.forEach(img => {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url: img.data }
                });
            });
            
            return { role: 'user', content: contentParts };
        }
        
        return { role: 'user', content: content };
    }
    
    formatMessagesForAPI() {
        return this.messages.map(msg => {
            if (Array.isArray(msg.content)) {
                return msg;
            }
            return { role: msg.role, content: msg.content };
        });
    }
    
    async callAPI(messages) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.currentModel,
                messages: messages
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data.content;
    }
    
    hideWelcome() {
        if (this.welcomeScreen) {
            this.welcomeScreen.style.display = 'none';
        }
    }
    
    showWelcome() {
        if (this.welcomeScreen) {
            this.welcomeScreen.style.display = 'flex';
        }
    }
    
    addMessageToUI(role, content, images = [], isHtml = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = role === 'user' ? '👤' : '🎓';
        const roleName = role === 'user' ? 'You' : 'BossAI';
        
        let imagesHtml = '';
        if (images.length > 0) {
            imagesHtml = `<div class="message-images">${images.map(img => 
                `<img src="${img.data}" alt="Attached image">`
            ).join('')}</div>`;
        }
        
        let contentHtml = '';
        if (content) {
            if (isHtml) {
                contentHtml = content;
            } else if (role === 'assistant') {
                contentHtml = this.parseMarkdown(content);
            } else {
                contentHtml = `<p>${this.escapeHtml(content)}</p>`;
            }
        }
        
        const speakBtn = role === 'assistant' ? `
            <button class="msg-action-btn speak-btn" onclick="app.speak(\`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" title="Read aloud">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
            </button>
        ` : '';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatar}</div>
                <span class="message-role">${roleName}</span>
                <div class="message-actions">
                    ${speakBtn}
                </div>
            </div>
            ${imagesHtml}
            <div class="message-content">${contentHtml}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        
        if (role === 'assistant' && !isHtml) {
            this.highlightCode(messageDiv);
            this.addCopyButtons(messageDiv);
        }
        
        this.scrollToBottom();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    parseMarkdown(text) {
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true
        });
        return marked.parse(text);
    }
    
    highlightCode(container) {
        container.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
    
    addCopyButtons(container) {
        container.querySelectorAll('pre').forEach((pre) => {
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.textContent = 'Copy';
            btn.addEventListener('click', () => {
                const code = pre.querySelector('code');
                navigator.clipboard.writeText(code.textContent);
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            });
            pre.appendChild(btn);
        });
    }
    
    addTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'message assistant';
        div.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">🎓</div>
                <span class="message-role">BossAI</span>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
        return div;
    }
    
    addErrorMessage(message) {
        const div = document.createElement('div');
        div.className = 'error-message';
        div.textContent = message;
        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    }
    
    async saveConversation() {
        if (this.messages.length === 0) return;
        
        if (!this.currentConversationId) {
            this.currentConversationId = Date.now().toString();
        }
        
        const title = this.getConversationTitle();
        
        const conversation = {
            id: this.currentConversationId,
            title: title,
            messages: this.messages,
            updatedAt: Date.now()
        };
        
        this.saveToLocalStorage(conversation);
        
        if (this.db && this.userId) {
            try {
                await this.db.collection('users').doc(this.userId).collection('conversations').doc(this.currentConversationId).set(conversation);
            } catch (error) {
                console.log('Firebase save failed, data saved to localStorage');
            }
        }
        
        this.renderConversationList();
    }
    
    saveToLocalStorage(conversation) {
        const existingIndex = this.conversations.findIndex(c => c.id === this.currentConversationId);
        
        if (existingIndex >= 0) {
            this.conversations[existingIndex] = conversation;
        } else {
            this.conversations.unshift(conversation);
        }
        
        localStorage.setItem('ai_conversations', JSON.stringify(this.conversations));
    }
    
    getConversationTitle() {
        const firstUserMessage = this.messages.find(m => m.role === 'user');
        if (!firstUserMessage) return 'New Chat';
        
        const content = Array.isArray(firstUserMessage.content) 
            ? firstUserMessage.content.find(c => c.type === 'text')?.text || 'Image chat'
            : firstUserMessage.content;
        
        return content.slice(0, 40) + (content.length > 40 ? '...' : '');
    }
    
    async loadConversationsFromFirebase() {
        if (!this.db || !this.userId) return;
        
        try {
            const snapshot = await this.db.collection('users').doc(this.userId).collection('conversations')
                .orderBy('updatedAt', 'desc')
                .limit(50)
                .get();
            
            this.conversations = snapshot.docs.map(doc => doc.data());
            this.renderConversationList();
        } catch (error) {
            console.log('Failed to load from Firebase, falling back to localStorage');
            this.loadConversations();
        }
    }
    
    loadConversations() {
        const saved = localStorage.getItem('ai_conversations');
        if (saved) {
            this.conversations = JSON.parse(saved);
            this.renderConversationList();
        }
    }
    
    renderConversationList() {
        const listHtml = this.conversations.slice(0, 20).map(conv => `
            <div class="conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}" 
                 data-id="${conv.id}">
                ${conv.title}
            </div>
        `).join('');
        
        this.conversationList.innerHTML = `
            <div class="conversation-section">
                <span class="section-label">Recent Chats</span>
                ${listHtml}
            </div>
        `;
        
        this.conversationList.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => this.loadConversation(item.dataset.id));
        });
    }
    
    loadConversation(id) {
        const conversation = this.conversations.find(c => c.id === id);
        if (!conversation) return;
        
        this.currentConversationId = id;
        this.messages = conversation.messages;
        
        this.messagesContainer.innerHTML = '';
        this.hideWelcome();
        
        this.messages.forEach(msg => {
            if (msg.role === 'user') {
                const images = Array.isArray(msg.content) 
                    ? msg.content.filter(c => c.type === 'image_url').map(c => ({ data: c.image_url.url }))
                    : [];
                const text = Array.isArray(msg.content)
                    ? msg.content.find(c => c.type === 'text')?.text || ''
                    : msg.content;
                this.addMessageToUI('user', text, images);
            } else {
                const isHtml = msg.content.includes('<img') && msg.content.includes('generated-image');
                this.addMessageToUI('assistant', msg.content, [], isHtml);
            }
        });
        
        this.renderConversationList();
        this.closeSidebar();
    }
    
    newChat() {
        this.currentConversationId = null;
        this.messages = [];
        this.attachedImages = [];
        this.messagesContainer.innerHTML = '';
        this.imagePreviewContainer.innerHTML = '';
        this.showWelcome();
        this.renderConversationList();
        this.closeSidebar();
    }
}

const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(styleSheet);

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AIChatApp();
});
