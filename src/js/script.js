// 80年代レトロテトリスゲーム
class RetroTetris {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // ゲーム設定
        this.COLS = 10;
        this.ROWS = 20;
        this.BLOCK_SIZE = 30;
        
        // ゲーム状態
        this.board = this.createBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropTime = 0;
        this.dropInterval = 1000; // ミリ秒
        this.lastTime = 0;
        this.gameRunning = false;
        this.gamePaused = false;
        
        // 現在のピースと次のピース
        this.currentPiece = null;
        this.nextPiece = null;
        
        // コントロール
        this.keys = {};
        
        // 音楽
        this.audioContext = null;
        this.isMusicPlaying = false;
        this.musicVolume = 0.5;
        
        this.initializeTetrominos();
        this.initializeColors();
        this.initializeControls();
        this.initializeAudio();
        this.initializeUI();
    }
    
    // テトロミノの定義
    initializeTetrominos() {
        this.TETROMINOS = {
            'I': [
                [1, 1, 1, 1]
            ],
            'O': [
                [1, 1],
                [1, 1]
            ],
            'T': [
                [0, 1, 0],
                [1, 1, 1]
            ],
            'S': [
                [0, 1, 1],
                [1, 1, 0]
            ],
            'Z': [
                [1, 1, 0],
                [0, 1, 1]
            ],
            'J': [
                [1, 0, 0],
                [1, 1, 1]
            ],
            'L': [
                [0, 0, 1],
                [1, 1, 1]
            ]
        };
    }
    
    // レトロカラーパレット
    initializeColors() {
        this.COLORS = {
            'I': '#39ff14', // ネオングリーン
            'O': '#ffff00', // ネオンイエロー
            'T': '#ff073a', // ネオンピンク
            'S': '#4169e1', // ネオンブルー
            'Z': '#ff4500', // ネオンオレンジ
            'J': '#9932cc', // ネオンパープル
            'L': '#00ffff'  // ネオンシアン
        };
    }
    
    createBoard() {
        return Array(this.ROWS).fill().map(() => Array(this.COLS).fill(0));
    }
    
    // ランダムテトロミノ生成
    createPiece() {
        const types = Object.keys(this.TETROMINOS);
        const type = types[Math.floor(Math.random() * types.length)];
        return {
            type: type,
            shape: this.TETROMINOS[type],
            x: Math.floor(this.COLS / 2) - Math.floor(this.TETROMINOS[type][0].length / 2),
            y: 0,
            color: this.COLORS[type]
        };
    }
    
    // ピースの回転
    rotatePiece(piece) {
        const rotated = piece.shape[0].map((_, index) =>
            piece.shape.map(row => row[index]).reverse()
        );
        return { ...piece, shape: rotated };
    }
    
    // 衝突検出
    checkCollision(piece, dx = 0, dy = 0) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const newX = piece.x + x + dx;
                    const newY = piece.y + y + dy;
                    
                    if (newX < 0 || newX >= this.COLS || newY >= this.ROWS) {
                        return true;
                    }
                    
                    if (newY >= 0 && this.board[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    // ピースをボードに固定
    placePiece(piece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const boardY = piece.y + y;
                    const boardX = piece.x + x;
                    if (boardY >= 0) {
                        this.board[boardY][boardX] = piece.color;
                    }
                }
            }
        }
    }
    
    // ライン消去チェック
    clearLines() {
        let linesCleared = 0;
        for (let y = this.ROWS - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(this.COLS).fill(0));
                linesCleared++;
                y++; // 同じ行を再チェック
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += linesCleared * 100 * this.level * (linesCleared > 1 ? 2 : 1);
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 50);
            this.updateUI();
            this.playLineClearSound();
        }
    }
    
    // ピース移動
    movePiece(dx, dy) {
        if (!this.checkCollision(this.currentPiece, dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            return true;
        }
        return false;
    }
    
    // ピース回転
    rotatePieceIfPossible() {
        const rotated = this.rotatePiece(this.currentPiece);
        if (!this.checkCollision(rotated)) {
            this.currentPiece = rotated;
            this.playRotateSound();
        }
    }
    
    // ハードドロップ（瞬間落下）
    hardDrop() {
        while (!this.checkCollision(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
        }
        this.placePiece(this.currentPiece);
        this.clearLines();
        this.spawnNewPiece();
        this.playDropSound();
    }
    
    // 新しいピース生成
    spawnNewPiece() {
        this.currentPiece = this.nextPiece || this.createPiece();
        this.nextPiece = this.createPiece();
        
        if (this.checkCollision(this.currentPiece)) {
            this.gameOver();
        }
        
        this.drawNext();
    }
    
    // ゲームオーバー
    gameOver() {
        this.gameRunning = false;
        this.stopMusic();
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('game-over').classList.remove('hidden');
        this.playGameOverSound();
    }
    
    // ゲーム開始
    start() {
        if (!this.gameRunning) {
            this.reset();
            this.gameRunning = true;
            this.gamePaused = false;
            this.spawnNewPiece();
            this.lastTime = performance.now();
            this.gameLoop();
            this.startMusic();
            document.getElementById('start-btn').textContent = 'RUNNING';
        }
    }
    
    // ポーズ
    pause() {
        if (this.gameRunning) {
            this.gamePaused = !this.gamePaused;
            document.getElementById('pause-btn').textContent = this.gamePaused ? 'RESUME' : 'PAUSE';
            if (this.gamePaused) {
                this.stopMusic();
            } else {
                this.startMusic();
                this.lastTime = performance.now();
                this.gameLoop();
            }
        }
    }
    
    // リセット
    reset() {
        this.board = this.createBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = 1000;
        this.currentPiece = null;
        this.nextPiece = null;
        this.gameRunning = false;
        this.gamePaused = false;
        this.updateUI();
        this.draw();
        document.getElementById('start-btn').textContent = 'START';
        document.getElementById('pause-btn').textContent = 'PAUSE';
        document.getElementById('game-over').classList.add('hidden');
    }
    
    // UI更新
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
    }
    
    // メインゲームループ
    gameLoop() {
        if (!this.gameRunning || this.gamePaused) return;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        
        this.dropTime += deltaTime;
        
        if (this.dropTime > this.dropInterval) {
            if (!this.movePiece(0, 1)) {
                this.placePiece(this.currentPiece);
                this.clearLines();
                this.spawnNewPiece();
            }
            this.dropTime = 0;
        }
        
        this.draw();
        this.lastTime = currentTime;
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // 描画
    draw() {
        // キャンバスクリア
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // ボード描画
        this.drawBoard();
        
        // 現在のピース描画
        if (this.currentPiece) {
            this.drawPiece(this.currentPiece);
        }
        
        // グリッドライン描画
        this.drawGrid();
    }
    
    drawBoard() {
        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                if (this.board[y][x]) {
                    this.drawBlock(x, y, this.board[y][x]);
                }
            }
        }
    }
    
    drawPiece(piece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    this.drawBlock(piece.x + x, piece.y + y, piece.color);
                }
            }
        }
    }
    
    drawBlock(x, y, color) {
        const pixelX = x * this.BLOCK_SIZE;
        const pixelY = y * this.BLOCK_SIZE;
        
        // メインブロック
        this.ctx.fillStyle = color;
        this.ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        
        // ハイライト効果
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, 2);
        this.ctx.fillRect(pixelX, pixelY, 2, this.BLOCK_SIZE);
        
        // シャドウ効果
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(pixelX, pixelY + this.BLOCK_SIZE - 2, this.BLOCK_SIZE, 2);
        this.ctx.fillRect(pixelX + this.BLOCK_SIZE - 2, pixelY, 2, this.BLOCK_SIZE);
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(57, 255, 20, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.COLS; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.BLOCK_SIZE, 0);
            this.ctx.lineTo(x * this.BLOCK_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.ROWS; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.BLOCK_SIZE);
            this.ctx.lineTo(this.canvas.width, y * this.BLOCK_SIZE);
            this.ctx.stroke();
        }
    }
    
    drawNext() {
        if (!this.nextPiece) return;
        
        // キャンバスクリア
        this.nextCtx.fillStyle = '#000000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        const blockSize = 15;
        const offsetX = (this.nextCanvas.width - this.nextPiece.shape[0].length * blockSize) / 2;
        const offsetY = (this.nextCanvas.height - this.nextPiece.shape.length * blockSize) / 2;
        
        for (let y = 0; y < this.nextPiece.shape.length; y++) {
            for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                if (this.nextPiece.shape[y][x]) {
                    this.nextCtx.fillStyle = this.nextPiece.color;
                    this.nextCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            }
        }
    }
    
    // コントロール初期化
    initializeControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameRunning || this.gamePaused) return;
            
            switch(e.code) {
                case 'ArrowLeft':
                    this.movePiece(-1, 0);
                    break;
                case 'ArrowRight':
                    this.movePiece(1, 0);
                    break;
                case 'ArrowDown':
                    if (this.movePiece(0, 1)) {
                        this.score += 1;
                        this.updateUI();
                    }
                    break;
                case 'ArrowUp':
                    this.rotatePieceIfPossible();
                    break;
                case 'Space':
                    e.preventDefault();
                    this.hardDrop();
                    break;
            }
        });
    }
    
    // UI初期化
    initializeUI() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('pause-btn').addEventListener('click', () => this.pause());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        document.getElementById('restart-btn').addEventListener('click', () => this.start());
        document.getElementById('music-btn').addEventListener('click', () => this.toggleMusic());
        
        this.updateUI();
        this.draw();
    }
    
    // オーディオ初期化
    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }
    }
    
    // コロベイニキメロディー生成
    createKorobeinikiMelody() {
        if (!this.audioContext) return null;
        
        // コロベイニキの基本メロディー（周波数で表現）
        const notes = [
            { freq: 659.25, duration: 0.5 }, // E5
            { freq: 493.88, duration: 0.25 }, // B4
            { freq: 523.25, duration: 0.25 }, // C5
            { freq: 587.33, duration: 0.5 }, // D5
            { freq: 523.25, duration: 0.25 }, // C5
            { freq: 493.88, duration: 0.25 }, // B4
            { freq: 440.00, duration: 0.5 }, // A4
            { freq: 440.00, duration: 0.25 }, // A4
            { freq: 523.25, duration: 0.25 }, // C5
            { freq: 659.25, duration: 0.5 }, // E5
            { freq: 587.33, duration: 0.25 }, // D5
            { freq: 523.25, duration: 0.25 }, // C5
            { freq: 493.88, duration: 1.0 }, // B4
            { freq: 523.25, duration: 0.25 }, // C5
            { freq: 587.33, duration: 0.5 }, // D5
            { freq: 659.25, duration: 0.5 }, // E5
            { freq: 523.25, duration: 0.5 }, // C5
            { freq: 440.00, duration: 0.5 }, // A4
            { freq: 440.00, duration: 1.0 }  // A4
        ];
        
        return notes;
    }
    
    // 音楽再生
    async startMusic() {
        if (!this.audioContext || this.isMusicPlaying) return;
        
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isMusicPlaying = true;
            this.playMelody();
        } catch (e) {
            console.log('Music playback failed:', e);
        }
    }
    
    async playMelody() {
        if (!this.isMusicPlaying || !this.audioContext) return;
        
        const notes = this.createKorobeinikiMelody();
        let startTime = this.audioContext.currentTime;
        
        for (const note of notes) {
            if (!this.isMusicPlaying) break;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(note.freq, startTime);
            oscillator.type = 'square'; // レトロなサウンド
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(this.musicVolume * 0.1, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + note.duration);
            
            startTime += note.duration;
        }
        
        // メロディーをループ
        setTimeout(() => {
            if (this.isMusicPlaying) {
                this.playMelody();
            }
        }, startTime * 1000 - this.audioContext.currentTime * 1000);
    }
    
    stopMusic() {
        this.isMusicPlaying = false;
    }
    
    toggleMusic() {
        if (this.isMusicPlaying) {
            this.stopMusic();
            document.getElementById('music-btn').textContent = '🔇 BGM';
        } else {
            this.startMusic();
            document.getElementById('music-btn').textContent = '🎵 BGM';
        }
    }
    
    // 効果音
    playSound(frequency, duration, type = 'square') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playRotateSound() {
        this.playSound(800, 0.1);
    }
    
    playDropSound() {
        this.playSound(200, 0.2);
    }
    
    playLineClearSound() {
        this.playSound(1000, 0.3);
    }
    
    playGameOverSound() {
        setTimeout(() => this.playSound(150, 1, 'sawtooth'), 0);
    }
}

// ゲーム初期化
let game;

document.addEventListener('DOMContentLoaded', () => {
    game = new RetroTetris();
    
    // タッチデバイス用のコントロール
    if ('ontouchstart' in window) {
        addMobileControls();
    }
});

// モバイル用コントロール追加
function addMobileControls() {
    const mobileControls = document.createElement('div');
    mobileControls.className = 'mobile-controls';
    
    const controls = [
        { text: '←', action: () => game.movePiece(-1, 0) },
        { text: '→', action: () => game.movePiece(1, 0) },
        { text: '↑', action: () => game.rotatePieceIfPossible() },
        { text: '↓', action: () => game.movePiece(0, 1) },
        { text: '■', action: () => game.hardDrop() }
    ];
    
    controls.forEach(control => {
        const button = document.createElement('button');
        button.textContent = control.text;
        button.className = 'bg-neon-green text-black font-bold rounded';
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (game.gameRunning && !game.gamePaused) {
                control.action();
            }
        });
        mobileControls.appendChild(button);
    });
    
    document.body.appendChild(mobileControls);
}