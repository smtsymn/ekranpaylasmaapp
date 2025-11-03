// ScreenShare Pro - Main JavaScript
class ScreenShareApp {
    constructor() {
        this.stream = null;
        this.audioEnabled = false;
        this.videoEnabled = true;
        this.isSharing = false;
        
        // YENİ EKLENEN: URL'den mod belirleme
        const urlParams = new URLSearchParams(window.location.search);
        this.currentMode = urlParams.get('mode') || localStorage.getItem('screenShareMode') || 'viewer';
        
        this.settings = {
            videoQuality: 'medium',
            frameRate: 30,
            autoQuality: true,
            showStats: true,
            autoJoin: false,
            rememberMode: false,
            chatNotifications: true,
            voiceNotifications: true,
            notificationVolume: 50
        };
        this.stats = {
            fps: 0,
            latency: 0,
            bitrate: 0
        };
        this.statsInterval = null;
        
        // Chat and voice properties
        this.chatMessages = [];
        this.voiceParticipants = [];
        this.isInVoiceChat = false;
        this.notificationSound = null;
        this.userId = this.generateUserId();
        
        // WebRTC properties
        this.socket = null;
        this.peerConnections = {};
        this.localStream = null;
        this.roomId = this.getRoomIdFromURL();
        
        this.init();
    }

    // YENİ EKLENEN: URL'den room ID alma
    getRoomIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        // Eğer URL'de room yoksa, null döndür (oda seçim modal'ı gösterilecek)
        return roomId || null;
    }

    // YENİ EKLENEN: Otomatik room ID oluşturma - Güvenli kod formatı
    generateRoomId() {
        // Kısa ve okunabilir oda kodu oluştur (örn: ABC-123)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const numbers = '23456789';
        const part1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const part2 = Array.from({length: 3}, () => numbers[Math.floor(Math.random() * numbers.length)]).join('');
        return `${part1}-${part2}`;
    }

    init() {
        this.loadSettings();
        this.checkBrowserSupport();
        this.hideLoadingScreen();
        
        // Eğer URL'de room yoksa, oda seçim modal'ını göster
        if (!this.roomId) {
            this.showRoomSelection();
        } else {
            // URL'de room varsa, direkt bağlan
            this.updateModeUI();
            this.initSocket();
        }
        
        this.bindEvents();
        this.updateStats();
    }

    // YENİ EKLENEN: Oda seçim modal'ını göster
    showRoomSelection() {
        const roomModal = document.getElementById('room-modal');
        if (roomModal) {
            roomModal.style.display = 'flex';
            
            // Enter tuşu ile giriş yapma
            const roomCodeInput = document.getElementById('room-code-input');
            if (roomCodeInput) {
                roomCodeInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        document.getElementById('join-room-btn').click();
                    }
                });
            }
        }
    }

    // YENİ EKLENEN: Oda seçim modal'ını gizle
    hideRoomSelection() {
        const roomModal = document.getElementById('room-modal');
        if (roomModal) {
            roomModal.style.display = 'none';
        }
    }

    // YENİ EKLENEN: Yeni oda oluştur
    createRoom() {
        const newRoomId = this.generateRoomId();
        this.roomId = newRoomId;
        
        // URL'yi güncelle
        const url = new URL(window.location);
        url.searchParams.set('room', newRoomId);
        window.history.pushState({}, '', url);
        
        // Modal'ı kapat ve bağlan
        this.hideRoomSelection();
        this.showNotification(`Yeni oda oluşturuldu: ${newRoomId}`, 'success');
        
        // Oda kodunu göster
        this.showRoomCode(newRoomId);
        
        // Socket bağlantısını başlat
        this.updateModeUI();
        this.initSocket();
    }

    // YENİ EKLENEN: Oda kodunu göster (updateRoomInfo ile birleştirildi)
    showRoomCode(roomCode) {
        this.roomId = roomCode;
        this.updateRoomInfo();
    }

    // YENİ EKLENEN: Kod ile odaya katıl
    joinRoomByCode() {
        const roomCodeInput = document.getElementById('room-code-input');
        if (!roomCodeInput) return;
        
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        
        if (!roomCode) {
            this.showNotification('Lütfen oda kodunu girin', 'error');
            roomCodeInput.focus();
            return;
        }

        // Oda kodunu temizle (sadece harf ve rakam)
        const cleanCode = roomCode.replace(/[^A-Z0-9-]/g, '');
        
        if (cleanCode.length < 3) {
            this.showNotification('Geçersiz oda kodu', 'error');
            roomCodeInput.focus();
            return;
        }

        this.roomId = cleanCode;
        
        // URL'yi güncelle
        const url = new URL(window.location);
        url.searchParams.set('room', cleanCode);
        window.history.pushState({}, '', url);
        
        // Modal'ı kapat ve bağlan
        this.hideRoomSelection();
        this.showNotification(`Odaya katılıyor: ${cleanCode}`, 'info');
        
        // Socket bağlantısını başlat
        this.updateModeUI();
        this.initSocket();
    }

    // YENİ EKLENEN: bindEvents fonksiyonu
    bindEvents() {
        // Room selection events - Oda seçim butonları
        const createRoomBtn = document.getElementById('create-room-btn');
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => this.createRoom());
        }

        const joinRoomBtn = document.getElementById('join-room-btn');
        if (joinRoomBtn) {
            joinRoomBtn.addEventListener('click', () => this.joinRoomByCode());
        }

        // Mode selection
        document.querySelectorAll('.mode-option').forEach(option => {
            option.addEventListener('click', () => {
                const mode = option.dataset.mode;
                this.setMode(mode);
            });
        });

        // Remember mode checkbox
        const rememberModeCheckbox = document.getElementById('remember-mode');
        if (rememberModeCheckbox) {
            rememberModeCheckbox.addEventListener('change', (e) => {
                this.settings.rememberMode = e.target.checked;
                this.saveSettings();
            });
        }

        // Switch mode button
        const switchModeBtn = document.getElementById('switch-mode-btn');
        if (switchModeBtn) {
            switchModeBtn.addEventListener('click', () => {
                this.showModeSelection();
            });
        }

        // Chat events
        const toggleChatBtn = document.getElementById('toggle-chat');
        if (toggleChatBtn) {
            toggleChatBtn.addEventListener('click', () => this.toggleChat());
        }

        const sendChatBtn = document.getElementById('send-chat');
        if (sendChatBtn) {
            sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        }

        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
        }

        // Voice chat events
        const toggleVoiceBtn = document.getElementById('toggle-voice');
        if (toggleVoiceBtn) {
            toggleVoiceBtn.addEventListener('click', () => this.toggleVoice());
        }

        const joinVoiceBtn = document.getElementById('join-voice');
        if (joinVoiceBtn) {
            joinVoiceBtn.addEventListener('click', () => this.joinVoiceChat());
        }

        const leaveVoiceBtn = document.getElementById('leave-voice');
        if (leaveVoiceBtn) {
            leaveVoiceBtn.addEventListener('click', () => this.leaveVoiceChat());
        }

        // Info toggle
        const toggleInfoBtn = document.getElementById('toggle-info');
        if (toggleInfoBtn) {
            toggleInfoBtn.addEventListener('click', () => this.toggleInfo());
        }

        // Main buttons
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.startSharing());
        }

        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopSharing());
        }

        const toggleAudioBtn = document.getElementById('toggle-audio-btn');
        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        }

        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        }
        
        // Settings
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        const closeSettingsBtn = document.getElementById('close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        }
        
        // Video controls
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        const qualityBtn = document.getElementById('quality-btn');
        if (qualityBtn) {
            qualityBtn.addEventListener('click', () => this.openSettings());
        }
        
        // Settings form
        const videoQualitySelect = document.getElementById('video-quality');
        if (videoQualitySelect) {
            videoQualitySelect.addEventListener('change', (e) => this.updateSetting('videoQuality', e.target.value));
        }

        const frameRateSelect = document.getElementById('frame-rate');
        if (frameRateSelect) {
            frameRateSelect.addEventListener('change', (e) => this.updateSetting('frameRate', parseInt(e.target.value)));
        }

        const autoQualityCheckbox = document.getElementById('auto-quality');
        if (autoQualityCheckbox) {
            autoQualityCheckbox.addEventListener('change', (e) => this.updateSetting('autoQuality', e.target.checked));
        }

        const showStatsCheckbox = document.getElementById('show-stats');
        if (showStatsCheckbox) {
            showStatsCheckbox.addEventListener('change', (e) => this.updateSetting('showStats', e.target.checked));
        }

        const autoJoinCheckbox = document.getElementById('auto-join');
        if (autoJoinCheckbox) {
            autoJoinCheckbox.addEventListener('change', (e) => this.updateSetting('autoJoin', e.target.checked));
        }

        const chatNotificationsCheckbox = document.getElementById('chat-notifications');
        if (chatNotificationsCheckbox) {
            chatNotificationsCheckbox.addEventListener('change', (e) => this.updateSetting('chatNotifications', e.target.checked));
        }

        const voiceNotificationsCheckbox = document.getElementById('voice-notifications');
        if (voiceNotificationsCheckbox) {
            voiceNotificationsCheckbox.addEventListener('change', (e) => this.updateSetting('voiceNotifications', e.target.checked));
        }

        const notificationVolumeRange = document.getElementById('notification-volume');
        if (notificationVolumeRange) {
            notificationVolumeRange.addEventListener('input', (e) => this.updateNotificationVolume(e.target.value));
        }
        
        // Modal backdrop click
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settings-modal') {
                    this.closeSettings();
                }
            });
        }

        const modeModal = document.getElementById('mode-modal');
        if (modeModal) {
            modeModal.addEventListener('click', (e) => {
                if (e.target.id === 'mode-modal') {
                    // Don't close mode modal on backdrop click - user must choose
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Visibility change (when user switches tabs)
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    // YENİ EKLENEN: updateModeUI fonksiyonu
    updateModeUI() {
        const modeBadge = document.getElementById('mode-badge');
        const switchModeBtn = document.getElementById('switch-mode-btn');
        
        if (this.currentMode) {
            if (modeBadge) {
                modeBadge.textContent = this.currentMode === 'viewer' ? 'İzleyici' : 'Yayıncı';
                modeBadge.className = `mode-badge ${this.currentMode}`;
                modeBadge.classList.remove('hidden');
            }
            
            // Update switch mode button icon
            if (switchModeBtn) {
                const icon = switchModeBtn.querySelector('i');
                if (icon) {
                    icon.className = this.currentMode === 'viewer' ? 'fas fa-broadcast-tower' : 'fas fa-eye';
                }
                switchModeBtn.title = this.currentMode === 'viewer' ? 'Yayıncı Moduna Geç' : 'İzleyici Moduna Geç';
            }
        } else {
            if (modeBadge) {
                modeBadge.classList.add('hidden');
            }
        }
    }

    // YENİ EKLENEN: Socket.IO başlatma - Ortak oda bağlantısı
    initSocket() {
        try {
            // Socket.IO bağlantısını başlat
            this.socket = io({
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
                timeout: 20000
            });
            
            this.socket.on('connect', () => {
                console.log('Socket.IO bağlandı - Ortak odaya bağlanılıyor...');
                this.updateConnectionStatus('connected');
                this.joinRoom();
                this.updateRoomInfo(); // Oda bilgisini güncelle
            });

            this.socket.on('disconnect', () => {
                console.log('Socket.IO bağlantısı kesildi');
                this.updateConnectionStatus('disconnected');
            });

            this.socket.on('reconnect', () => {
                console.log('Socket.IO yeniden bağlandı');
                this.updateConnectionStatus('connected');
                this.joinRoom(); // Yeniden bağlanınca odaya tekrar katıl
            });

            this.socket.on('connect_error', (error) => {
                console.error('Socket.IO bağlantı hatası:', error);
                this.updateConnectionStatus('error');
            });

            this.socket.on('room-joined', (roomId, userCount) => {
                console.log(`Ortak odaya başarıyla katıldınız: ${roomId} | Toplam kullanıcı: ${userCount}`);
                this.updateRoomInfo(); // Oda bilgisini güncelle
            });

            this.socket.on('user-joined', (userId, mode, socketId) => {
                console.log('Kullanıcı ortak odaya katıldı:', userId, mode, socketId);
                if (mode === 'broadcaster' && this.currentMode === 'viewer') {
                    // Yayıncı katıldı, bağlantı kur
                    if (socketId) {
                        this.handleBroadcasterJoined(socketId);
                    } else {
                        // Socket ID yoksa, odadaki yayıncıları sorgula
                        this.requestBroadcasters();
                    }
                }
            });
            
            // Yayıncı listesi alındığında
            this.socket.on('broadcasters-list', (broadcasters) => {
                if (this.currentMode === 'viewer' && broadcasters.length > 0) {
                    console.log('Yayıncılar bulundu:', broadcasters);
                    broadcasters.forEach(broadcaster => {
                        this.handleBroadcasterJoined(broadcaster.socketId);
                    });
                }
            });

            this.socket.on('user-left', (userId) => {
                console.log('Kullanıcı ortak odadan ayrıldı:', userId);
                // Yayıncı ayrıldıysa, viewer'lar için bildirim göster
                if (this.currentMode === 'viewer') {
                    this.showNotification('Yayıncı odadan ayrıldı', 'info');
                }
            });

            this.socket.on('offer', (data) => {
                this.handleOffer(data);
            });

            this.socket.on('answer', (data) => {
                this.handleAnswer(data);
            });

            this.socket.on('ice-candidate', (data) => {
                this.handleIceCandidate(data);
            });

            // Chat mesajı alındığında
            this.socket.on('chat-message', (data) => {
                if (data.userId !== this.userId) {
                    this.addChatMessage(data.userId, data.message, false);
                }
            });

            // Yayıncı stream başladığında bildirim
            this.socket.on('broadcast-started', (broadcasterId, broadcasterUserId) => {
                if (this.currentMode === 'viewer') {
                    console.log('Yayıncı stream başladı:', broadcasterUserId);
                    // Yayıncı ile bağlantı kur
                    this.handleBroadcasterJoined(broadcasterId);
                }
            });

        } catch (error) {
            console.error('Socket.IO başlatma hatası:', error);
            this.updateConnectionStatus('error');
            this.hideLoadingScreen(); // Hata olsa bile loading'i kapat
        }
    }

    // Bağlantı durumunu güncelle
    updateConnectionStatus(status) {
        const connectionStatus = document.getElementById('connection-status');
        const statusIndicator = document.getElementById('status-indicator');
        
        if (connectionStatus && statusIndicator) {
            switch(status) {
                case 'connected':
                    connectionStatus.textContent = 'Bağlı';
                    connectionStatus.className = 'status-text connected';
                    statusIndicator.className = 'status-dot active';
                    break;
                case 'disconnected':
                    connectionStatus.textContent = 'Bağlantı kesildi';
                    connectionStatus.className = 'status-text disconnected';
                    statusIndicator.className = 'status-dot';
                    break;
                case 'error':
                    connectionStatus.textContent = 'Bağlantı hatası';
                    connectionStatus.className = 'status-text error';
                    statusIndicator.className = 'status-dot error';
                    break;
                default:
                    connectionStatus.textContent = 'Bağlanıyor...';
                    connectionStatus.className = 'status-text';
                    statusIndicator.className = 'status-dot';
            }
        }
    }

    // YENİ EKLENEN: Ortak odaya katılma
    joinRoom() {
        if (this.socket && this.socket.connected) {
            console.log(`Ortak odaya katılıyor: ${this.roomId} | Kullanıcı: ${this.userId} | Mod: ${this.currentMode}`);
            this.socket.emit('join-room', this.roomId, this.userId, this.currentMode);
            this.showNotification(`Ortak odaya katıldınız: ${this.roomId}`, 'success');
            
            // Viewer ise ve yayıncı varsa bağlan
            if (this.currentMode === 'viewer') {
                setTimeout(() => {
                    this.requestBroadcasters();
                }, 1000);
            }
        } else {
            console.warn('Socket bağlantısı yok, odaya katılınamıyor');
            // Socket bağlantısı yoksa, bağlantıyı tekrar dene
            setTimeout(() => {
                if (!this.socket || !this.socket.connected) {
                    this.initSocket();
                }
            }, 2000);
        }
    }

    // Yayıncıları sorgula
    requestBroadcasters() {
        if (this.socket && this.socket.connected && this.roomId) {
            this.socket.emit('request-broadcasters', this.roomId);
        }
    }

    // YENİ EKLENEN: Room bilgisini UI'da gösterme - Oda kodu ile
    updateRoomInfo() {
        const roomInfo = document.getElementById('room-info');
        if (roomInfo && this.roomId) {
            roomInfo.innerHTML = `<i class="fas fa-link"></i> Oda: ${this.roomId}`;
            roomInfo.style.cursor = 'pointer';
            roomInfo.title = 'Oda kodunu kopyalamak için tıklayın';
            
            // Kopyalama özelliği - eski event listener'ı kaldır ve yeni ekle
            const newRoomInfo = roomInfo.cloneNode(true);
            roomInfo.parentNode.replaceChild(newRoomInfo, roomInfo);
            
            newRoomInfo.addEventListener('click', () => {
                navigator.clipboard.writeText(this.roomId).then(() => {
                    this.showNotification('Oda kodu kopyalandı!', 'success');
                }).catch(() => {
                    this.showNotification('Oda kodu kopyalanamadı', 'error');
                });
            });
        }
        
        // URL'yi paylaşılabilir hale getir
        if (this.roomId) {
            const shareUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomId}&mode=${this.currentMode}`;
            console.log('Paylaşım URL\'si:', shareUrl);
            this.addCopyUrlButton(shareUrl);
        }
    }

    // YENİ EKLENEN: URL kopyalama butonu
    addCopyUrlButton(shareUrl) {
        const headerControls = document.querySelector('.header-controls');
        if (headerControls && !document.getElementById('copy-url-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.id = 'copy-url-btn';
            copyBtn.className = 'btn btn-icon';
            copyBtn.title = 'URL\'yi Kopyala';
            copyBtn.innerHTML = '<i class="fas fa-link"></i>';
            
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(shareUrl).then(() => {
                    this.showNotification('URL kopyalandı!', 'success');
                }).catch(() => {
                    this.showNotification('URL kopyalanamadı', 'error');
                });
            });
            
            headerControls.insertBefore(copyBtn, headerControls.firstChild);
        }
    }

    // YENİ EKLENEN: Yayıncı katıldığında izleyici tarafında çalışır
    async handleBroadcasterJoined(broadcasterId) {
        if (this.currentMode !== 'viewer') return;
        
        // Eğer zaten bu yayıncı ile bağlantı varsa, tekrar bağlanma
        if (this.peerConnections[broadcasterId]) {
            console.log('Zaten bu yayıncı ile bağlantı var:', broadcasterId);
            return;
        }
        
        try {
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.peerConnections[broadcasterId] = peerConnection;

            peerConnection.ontrack = (event) => {
                console.log('Yayın stream alındı:', broadcasterId);
                const videoElement = document.getElementById('screen-view');
                if (videoElement) {
                    videoElement.srcObject = event.streams[0];
                    this.isSharing = true;
                    this.updateUI();
                    this.showNotification('Yayın başladı!', 'success');
                }
            };

            peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', peerConnection.iceConnectionState);
                if (peerConnection.iceConnectionState === 'failed') {
                    console.error('ICE bağlantısı başarısız');
                    this.showNotification('Bağlantı hatası', 'error');
                }
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.socket && this.socket.connected) {
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        roomId: this.roomId,
                        targetId: broadcasterId
                    });
                }
            };

            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnection.setLocalDescription(offer);
            
            if (this.socket && this.socket.connected) {
                this.socket.emit('offer', {
                    offer: offer,
                    roomId: this.roomId,
                    targetId: broadcasterId,
                    fromId: this.socket.id
                });
            }

        } catch (error) {
            console.error('Bağlantı hatası:', error);
            this.showNotification('Yayın bağlantısı kurulamadı', 'error');
        }
    }

    // YENİ EKLENEN: Offer alındığında yayıncı tarafında çalışır
    async handleOffer(data) {
        const { offer, fromId } = data;
        if (this.currentMode !== 'broadcaster' || !this.localStream) {
            console.log('Offer reddedildi - broadcaster değil veya stream yok');
            return;
        }

        // Eğer zaten bu viewer ile bağlantı varsa, tekrar bağlanma
        if (this.peerConnections[fromId]) {
            console.log('Zaten bu viewer ile bağlantı var:', fromId);
            return;
        }

        try {
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.peerConnections[fromId] = peerConnection;

            // Stream'i ekle
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });

            peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE connection state (broadcaster):', peerConnection.iceConnectionState);
                if (peerConnection.iceConnectionState === 'failed') {
                    console.error('ICE bağlantısı başarısız (broadcaster)');
                }
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.socket && this.socket.connected) {
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        roomId: this.roomId,
                        targetId: fromId
                    });
                }
            };

            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            if (this.socket && this.socket.connected) {
                this.socket.emit('answer', {
                    answer: answer,
                    roomId: this.roomId,
                    targetId: fromId,
                    fromId: this.socket.id
                });
            }

            console.log('Offer kabul edildi ve answer gönderildi:', fromId);

        } catch (error) {
            console.error('Offer hatası:', error);
            this.showNotification('Viewer bağlantısı kurulamadı', 'error');
        }
    }

    // YENİ EKLENEN: Answer işleme
    async handleAnswer(data) {
        const { answer, fromId } = data;
        const peerConnection = this.peerConnections[fromId];
        if (peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('Answer alındı ve işlendi:', fromId);
            } catch (error) {
                console.error('Answer işleme hatası:', error);
            }
        }
    }

    // YENİ EKLENEN: ICE candidate işleme
    async handleIceCandidate(data) {
        const { candidate, targetId } = data;
        const peerConnection = this.peerConnections[targetId];
        if (peerConnection && candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('ICE candidate ekleme hatası:', error);
            }
        }
    }

    async startSharing() {
        if (this.currentMode !== 'broadcaster') {
            this.showNotification('Yayıncı modunda olmalısınız', 'error');
            return;
        }

        try {
            this.showStatusOverlay('Ekran paylaşımı başlatılıyor...');
            
            const constraints = this.getVideoConstraints();
            
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: constraints.video,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000
                }
            });

            this.audioEnabled = this.localStream.getAudioTracks().length > 0;
            
            const videoElement = document.getElementById('screen-view');
            videoElement.srcObject = this.localStream;
            
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = resolve;
            });

            this.isSharing = true;
            this.updateUI();
            this.hideStatusOverlay();
            
            // Odaya yayın başladığını bildir
            if (this.socket && this.socket.connected && this.roomId) {
                this.socket.emit('broadcast-started', this.roomId, this.userId);
            }

            // Mevcut peer connection'lara stream ekle
            Object.values(this.peerConnections).forEach(pc => {
                this.localStream.getTracks().forEach(track => {
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === track.kind);
                    if (sender) {
                        sender.replaceTrack(track);
                    } else {
                        pc.addTrack(track, this.localStream);
                    }
                });
            });

            this.localStream.getVideoTracks()[0].onended = () => {
                this.stopSharing();
            };

            this.startStatsMonitoring();
            this.showNotification('Ekran paylaşımı başlatıldı!', 'success');
            
        } catch (err) {
            this.hideStatusOverlay();
            this.handleError('Ekran paylaşımı başlatılamadı', err);
        }
    }

    stopSharing() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        Object.values(this.peerConnections).forEach(pc => pc.close());
        this.peerConnections = {};

        const videoElement = document.getElementById('screen-view');
        videoElement.srcObject = null;
        
        this.isSharing = false;
        this.audioEnabled = false;
        this.videoEnabled = true;
        
        this.stopStatsMonitoring();
        this.updateUI();
        
        this.showNotification('Ekran paylaşımı durduruldu', 'info');
    }

    toggleAudio() {
        if (!this.stream) return;
        
        const audioTracks = this.stream.getAudioTracks();
        if (audioTracks.length > 0) {
            this.audioEnabled = !this.audioEnabled;
            audioTracks[0].enabled = this.audioEnabled;
            this.updateAudioButton();
            
            const status = this.audioEnabled ? 'açıldı' : 'kapatıldı';
            this.showNotification(`Ses ${status}`, 'info');
        }
    }

    toggleVideo() {
        if (!this.stream) return;
        
        const videoTracks = this.stream.getVideoTracks();
        if (videoTracks.length > 0) {
            this.videoEnabled = !this.videoEnabled;
            videoTracks[0].enabled = this.videoEnabled;
            this.updateVideoButton();
            
            const status = this.videoEnabled ? 'açıldı' : 'kapatıldı';
            this.showNotification(`Video ${status}`, 'info');
        }
    }

    updateUI() {
        const shareBtn = document.getElementById('share-btn');
        const stopBtn = document.getElementById('stop-btn');
        const toggleAudioBtn = document.getElementById('toggle-audio-btn');
        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        const placeholder = document.getElementById('placeholder');
        const videoControls = document.getElementById('video-controls');
        const statusIndicator = document.querySelector('.status-dot');
        const connectionStatus = document.getElementById('connection-status');
        const statsSection = document.querySelector('.sidebar-section:last-child');

        if (this.isSharing) {
            // Hide placeholder, show video
            placeholder.style.display = 'none';
            videoControls.classList.remove('hidden');
            
            // Update buttons
            shareBtn.disabled = true;
            stopBtn.disabled = false;
            toggleAudioBtn.disabled = !this.audioEnabled;
            toggleVideoBtn.disabled = false;
            
            // Update status
            statusIndicator.classList.add('active');
            connectionStatus.textContent = 'Paylaşım aktif';
            connectionStatus.className = 'status-text text-green-400';
            
            // Show stats if enabled
            if (this.settings.showStats) {
                statsSection.style.display = 'block';
            }
            
        } else {
            // Show placeholder, hide video
            placeholder.style.display = 'flex';
            videoControls.classList.add('hidden');
            
            // Update buttons based on mode
            if (this.currentMode === 'broadcaster') {
                shareBtn.disabled = false;
                stopBtn.disabled = true;
                toggleAudioBtn.disabled = true;
                toggleVideoBtn.disabled = true;
            } else {
                // Viewer mode - hide share button
                shareBtn.classList.add('hidden');
                stopBtn.disabled = true;
                toggleAudioBtn.disabled = true;
                toggleVideoBtn.disabled = true;
            }
            
            // Update status
            statusIndicator.classList.remove('active');
            connectionStatus.textContent = this.currentMode === 'viewer' ? 'Yayın bekleniyor' : 'Bağlantı yok';
            connectionStatus.className = 'status-text';
            
            // Hide stats
            statsSection.style.display = 'none';
        }

        this.updateAudioButton();
        this.updateVideoButton();
    }

    updateAudioButton() {
        const btn = document.getElementById('toggle-audio-btn');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (!this.stream) return;
        
        if (this.audioEnabled) {
            icon.className = 'fas fa-microphone';
            text.textContent = 'Ses';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-success');
        } else {
            icon.className = 'fas fa-microphone-slash';
            text.textContent = 'Ses Kapalı';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-secondary');
        }
    }

    updateVideoButton() {
        const btn = document.getElementById('toggle-video-btn');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (!this.stream) return;
        
        if (this.videoEnabled) {
            icon.className = 'fas fa-video';
            text.textContent = 'Video';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-success');
        } else {
            icon.className = 'fas fa-video-slash';
            text.textContent = 'Video Kapalı';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-secondary');
        }
    }

    getVideoConstraints() {
        const qualitySettings = {
            high: { width: 1920, height: 1080 },
            medium: { width: 1280, height: 720 },
            low: { width: 854, height: 480 }
        };

        return {
            video: {
                displaySurface: 'monitor',
                logicalSurface: true,
                cursor: 'always',
                frameRate: { ideal: this.settings.frameRate },
                ...qualitySettings[this.settings.videoQuality]
            }
        };
    }

    openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        
        if (key === 'showStats') {
            const statsSection = document.querySelector('.sidebar-section:last-child');
            statsSection.style.display = value ? 'block' : 'none';
        }
    }

    // YENİ EKLENEN: loadSettings fonksiyonu
    loadSettings() {
        const saved = localStorage.getItem('screenshare-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        
        // Update form values
        const videoQuality = document.getElementById('video-quality');
        const frameRate = document.getElementById('frame-rate');
        const autoQuality = document.getElementById('auto-quality');
        const showStats = document.getElementById('show-stats');
        const autoJoin = document.getElementById('auto-join');
        const rememberMode = document.getElementById('remember-mode');
        const chatNotifications = document.getElementById('chat-notifications');
        const voiceNotifications = document.getElementById('voice-notifications');
        const notificationVolume = document.getElementById('notification-volume');
        const volumeDisplay = document.getElementById('volume-display');

        if (videoQuality) videoQuality.value = this.settings.videoQuality;
        if (frameRate) frameRate.value = this.settings.frameRate;
        if (autoQuality) autoQuality.checked = this.settings.autoQuality;
        if (showStats) showStats.checked = this.settings.showStats;
        if (autoJoin) autoJoin.checked = this.settings.autoJoin;
        if (rememberMode) rememberMode.checked = this.settings.rememberMode;
        if (chatNotifications) chatNotifications.checked = this.settings.chatNotifications;
        if (voiceNotifications) voiceNotifications.checked = this.settings.voiceNotifications;
        if (notificationVolume) notificationVolume.value = this.settings.notificationVolume;
        if (volumeDisplay) volumeDisplay.textContent = this.settings.notificationVolume + '%';
    }

    // YENİ EKLENEN: saveSettings fonksiyonu
    saveSettings() {
        localStorage.setItem('screenshare-settings', JSON.stringify(this.settings));
    }

    // YENİ EKLENEN: checkBrowserSupport fonksiyonu
    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            const shareBtn = document.getElementById('share-btn');
            if (shareBtn) {
                shareBtn.disabled = true;
                shareBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Tarayıcı Desteklenmiyor';
                shareBtn.classList.add('btn-danger');
            }
            
            this.showNotification('Tarayıcınız ekran paylaşımını desteklemiyor. Chrome, Edge veya Firefox kullanın.', 'error');
        }
    }

    startStatsMonitoring() {
        if (!this.settings.showStats) return;
        
        this.statsInterval = setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    stopStatsMonitoring() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    // YENİ EKLENEN: updateStats fonksiyonu
    updateStats() {
        if (!this.stream || !this.settings.showStats) return;

        // Simulate stats (in real app, you'd get these from WebRTC stats)
        this.stats.fps = Math.floor(Math.random() * 30) + 20;
        this.stats.latency = Math.floor(Math.random() * 200) + 50;
        this.stats.bitrate = Math.floor(Math.random() * 5000) + 2000;

        const fpsCounter = document.getElementById('fps-counter');
        const latencyCounter = document.getElementById('latency-counter');
        const bitrateCounter = document.getElementById('bitrate-counter');

        if (fpsCounter) fpsCounter.textContent = this.stats.fps;
        if (latencyCounter) latencyCounter.textContent = `${this.stats.latency}ms`;
        if (bitrateCounter) bitrateCounter.textContent = `${(this.stats.bitrate / 1000).toFixed(1)}k`;

        // Update quality indicator
        const qualityLevel = document.getElementById('quality-level');
        const qualityText = document.getElementById('quality-text');
        
        if (qualityLevel && qualityText) {
            if (this.stats.fps > 25 && this.stats.latency < 100) {
                qualityLevel.style.width = '100%';
                qualityText.textContent = 'Kalite: Mükemmel';
            } else if (this.stats.fps > 20 && this.stats.latency < 200) {
                qualityLevel.style.width = '75%';
                qualityText.textContent = 'Kalite: İyi';
            } else if (this.stats.fps > 15 && this.stats.latency < 300) {
                qualityLevel.style.width = '50%';
                qualityText.textContent = 'Kalite: Orta';
            } else {
                qualityLevel.style.width = '25%';
                qualityText.textContent = 'Kalite: Düşük';
            }
        }
    }

    toggleFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen().catch(err => {
                this.showNotification('Tam ekran modu başlatılamadı', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }

    showStatusOverlay(message) {
        const overlay = document.getElementById('status-overlay');
        const messageSpan = overlay.querySelector('span');
        messageSpan.textContent = message;
        overlay.classList.remove('hidden');
    }

    hideStatusOverlay() {
        document.getElementById('status-overlay').classList.add('hidden');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    handleError(message, error) {
        console.error(message, error);
        this.showNotification(`${message}: ${error.message}`, 'error');
    }

    handleKeyboard(e) {
        // Escape key closes modals
        if (e.key === 'Escape') {
            this.closeSettings();
        }
        
        // Space key toggles play/pause (if video is playing)
        if (e.key === ' ' && this.isSharing) {
            e.preventDefault();
            const video = document.getElementById('screen-view');
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
        
        // F11 for fullscreen
        if (e.key === 'F11' && this.isSharing) {
            e.preventDefault();
            this.toggleFullscreen();
        }
    }

    handleVisibilityChange() {
        if (document.hidden && this.isSharing) {
            this.showNotification('Sekme arka planda çalışıyor', 'warning');
        }
    }

    handleResize() {
        // Update video container aspect ratio on mobile
        if (window.innerWidth <= 768) {
            const videoContainer = document.querySelector('.video-container');
            videoContainer.style.aspectRatio = '16/10';
        }
    }

    hideLoadingScreen() {
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        }, 1000);
    }

    // Chat Methods
    toggleChat() {
        const container = document.getElementById('chat-container');
        const icon = document.querySelector('#toggle-chat i');
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-down';
        } else {
            container.classList.add('collapsed');
            icon.className = 'fas fa-chevron-up';
        }
    }

    toggleVoice() {
        const container = document.getElementById('voice-container');
        const icon = document.querySelector('#toggle-voice i');
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-down';
        } else {
            container.classList.add('collapsed');
            icon.className = 'fas fa-chevron-up';
        }
    }

    toggleInfo() {
        const container = document.getElementById('info-container');
        const icon = document.querySelector('#toggle-info i');
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-down';
        } else {
            container.classList.add('collapsed');
            icon.className = 'fas fa-chevron-up';
        }
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Kendi mesajını göster
        this.addChatMessage(this.userId, message, true);
        input.value = '';
        
        // Socket.IO ile odaya gönder
        if (this.socket && this.socket.connected && this.roomId) {
            this.socket.emit('chat-message', {
                roomId: this.roomId,
                userId: this.userId,
                message: message,
                timestamp: new Date().toISOString()
            });
        } else {
            this.showNotification('Bağlantı yok, mesaj gönderilemedi', 'error');
        }
    }

    addChatMessage(userId, message, isOwn = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
        
        const time = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="chat-message-header">
                <span class="chat-message-user">${userId}</span>
                <span class="chat-message-time">${time}</span>
            </div>
            <div class="chat-message-text">${message}</div>
        `;
        
        // Remove welcome message if exists
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) {
            welcome.remove();
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Play notification sound if enabled and not own message
        if (!isOwn && this.settings.chatNotifications) {
            this.playNotificationSound();
        }
    }

    joinVoiceChat() {
        this.isInVoiceChat = true;
        this.updateVoiceUI();
        this.addVoiceParticipant(this.userId);
        this.showNotification('Sesli chat\'e katıldınız', 'success');
    }

    leaveVoiceChat() {
        this.isInVoiceChat = false;
        this.updateVoiceUI();
        this.removeVoiceParticipant(this.userId);
        this.showNotification('Sesli chat\'ten ayrıldınız', 'info');
    }

    updateVoiceUI() {
        const joinBtn = document.getElementById('join-voice');
        const leaveBtn = document.getElementById('leave-voice');
        const indicator = document.querySelector('.voice-indicator');
        const icon = indicator.querySelector('i');
        const text = indicator.querySelector('span');
        
        if (this.isInVoiceChat) {
            joinBtn.classList.add('hidden');
            leaveBtn.classList.remove('hidden');
            indicator.classList.add('connected');
            icon.className = 'fas fa-microphone';
            text.textContent = 'Ses açık';
        } else {
            joinBtn.classList.remove('hidden');
            leaveBtn.classList.add('hidden');
            indicator.classList.remove('connected');
            icon.className = 'fas fa-microphone-slash';
            text.textContent = 'Ses kapalı';
        }
    }

    addVoiceParticipant(userId) {
        const participants = document.getElementById('voice-participants');
        const noParticipants = participants.querySelector('.no-participants');
        
        if (noParticipants) {
            noParticipants.remove();
        }
        
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant-item';
        participantDiv.id = `participant-${userId}`;
        
        participantDiv.innerHTML = `
            <div class="participant-status"></div>
            <span class="participant-name">${userId}</span>
        `;
        
        participants.appendChild(participantDiv);
    }

    removeVoiceParticipant(userId) {
        const participant = document.getElementById(`participant-${userId}`);
        if (participant) {
            participant.remove();
        }
        
        // Show no participants message if empty
        const participants = document.getElementById('voice-participants');
        if (participants.children.length === 0) {
            participants.innerHTML = '<p class="no-participants">Henüz kimse sese katılmadı</p>';
        }
    }

    generateUserId() {
        return 'Kullanıcı_' + Math.random().toString(36).substr(2, 6);
    }

    playNotificationSound() {
        // Create a simple notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.settings.notificationVolume / 100, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }

    updateNotificationVolume(value) {
        this.settings.notificationVolume = parseInt(value);
        document.getElementById('volume-display').textContent = value + '%';
        this.saveSettings();
    }

    // YENİ EKLENEN: URL'ye mode parametresi ekleme
    updateURLWithMode(mode) {
        const url = new URL(window.location);
        url.searchParams.set('mode', mode);
        window.history.replaceState({}, '', url);
    }

    // YENİ EKLENEN: URL'den mode parametresini alma
    getModeFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('mode');
    }

    setMode(mode) {
        this.currentMode = mode;
        
        // YENİ EKLENEN: localStorage'a kaydet
        localStorage.setItem('screenShareMode', mode);
        
        // YENİ EKLENEN: URL'yi güncelle
        const url = new URL(window.location);
        url.searchParams.set('mode', mode);
        window.history.replaceState({}, '', url);
        
        this.updateModeUI();
        this.loadInstructions(); // Bu fonksiyonu tanımlayacağız
        this.updatePlaceholder();
        
        // Socket.IO bağlantısını yeniden başlat
        if (this.socket && this.socket.connected) {
            this.socket.disconnect();
            this.initSocket();
        }
        
        // Hide mode selection modal
        document.getElementById('mode-modal').classList.add('hidden');
        document.body.style.overflow = '';
        
        // Show notification
        const modeText = mode === 'viewer' ? 'İzleyici' : 'Yayıncı';
        this.showNotification(`${modeText} moduna geçildi`, 'success');
    }

    // YENİ EKLENEN: loadInstructions fonksiyonu
    loadInstructions() {
        const infoContent = document.getElementById('info-content');
        if (!infoContent) return;
        
        if (this.currentMode === 'viewer') {
            infoContent.innerHTML = `
                <div class="instruction-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Yayın Bekleyin</h4>
                        <p>Yayıncı bağlandığında otomatik olarak yayın başlar</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>İzleyin</h4>
                        <p>Paylaşılan ekranı gerçek zamanlı olarak izleyin</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Chat Yapın</h4>
                        <p>Diğer kullanıcılarla mesajlaşın</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Sese Katılın</h4>
                        <p>İsterseniz sesli chat'e katılın</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">5</div>
                    <div class="step-content">
                        <h4>Mod Değiştirin</h4>
                        <p>İsterseniz yayıncı moduna geçerek kendi paylaşımınızı yapın</p>
                    </div>
                </div>
            `;
        } else {
            infoContent.innerHTML = `
                <div class="instruction-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Ekran Paylaş</h4>
                        <p>Ana butona tıklayarak paylaşımı başlatın</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Paylaşım Seçin</h4>
                        <p>Ekran, pencere veya sekme seçin</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Ses Ekle</h4>
                        <p>İsteğe bağlı olarak sistem sesini dahil edin</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>İzleyicilerle Etkileşim</h4>
                        <p>Chat ve sesli chat ile izleyicilerle iletişim kurun</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">5</div>
                    <div class="step-content">
                        <h4>Kontrol Et</h4>
                        <p>Alt kontrollerle ses ve videoyu yönetin</p>
                    </div>
                </div>
            `;
        }
    }

    // YENİ EKLENEN: updatePlaceholder fonksiyonu
    updatePlaceholder() {
        const placeholderTitle = document.getElementById('placeholder-title');
        const placeholderDescription = document.getElementById('placeholder-description');
        const shareBtn = document.getElementById('share-btn');
        const viewerWaiting = document.getElementById('viewer-waiting');
        
        if (this.currentMode === 'viewer') {
            if (placeholderTitle) placeholderTitle.textContent = 'Yayın Bekleniyor';
            if (placeholderDescription) placeholderDescription.textContent = 'Yayıncı bağlandığında otomatik olarak yayın başlayacak';
            if (shareBtn) shareBtn.classList.add('hidden');
            if (viewerWaiting) viewerWaiting.classList.remove('hidden');
        } else {
            if (placeholderTitle) placeholderTitle.textContent = 'Ekran Paylaşımı Başlatın';
            if (placeholderDescription) placeholderDescription.textContent = 'Profesyonel ekran paylaşımı için aşağıdaki butona tıklayın';
            if (shareBtn) shareBtn.classList.remove('hidden');
            if (viewerWaiting) viewerWaiting.classList.add('hidden');
        }
    }

    // YENİ EKLENEN: showModeSelection fonksiyonu
    showModeSelection() {
        const modeModal = document.getElementById('mode-modal');
        if (modeModal) {
            modeModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScreenShareApp();
});

// Service Worker'ı kaldır - 404 hatası veriyor
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('/sw.js')
//             .then(registration => {
//                 console.log('SW registered: ', registration);
//             })
//             .catch(registrationError => {
//                 console.log('SW registration failed: ', registrationError);
//             });
//     });
// }

// Add touch support for mobile
document.addEventListener('touchstart', function() {}, {passive: true});

// Prevent zoom on double tap (mobile)
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false); 