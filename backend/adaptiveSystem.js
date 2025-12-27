
import os from 'os';
import { EventEmitter } from 'events';

class AdaptiveSystem extends EventEmitter {
    constructor() {
        super();
        
        // Configuration Thresholds (Relaxed for Render/Small Containers)
        this.config = {
            checkIntervalMs: 10000, // Check less frequently (10s) to save CPU
            cpuThresholds: { yellow: 0.8, red: 0.95 }, // High tolerance for CPU spikes
            memThresholds: { yellow: 0.85, red: 0.95 }, // High tolerance for Memory
            rpsThresholds: { yellow: 500, red: 1000 },
            
            // Dynamic Settings (Output)
            poolLimits: { green: 20, yellow: 15, red: 5 },
            rateLimits: { green: 2000, yellow: 1000, red: 200 }, 
            socketRate: { green: 1.0, yellow: 0.8, red: 0.2 } 
        };

        // Real-time Metrics
        this.metrics = {
            cpuLoad: 0,
            memoryUsage: 0,
            activeConnections: 0, // Socket.io
            currentRPS: 0,
            dbLatency: 0
        };

        this.state = 'GREEN'; // GREEN, YELLOW, RED
        this.requestCounter = 0;
        this.activeUsers = 0;
        
        // Start Monitoring
        this.startMonitoring();
    }

    startMonitoring() {
        // Reset RPS counter every second
        setInterval(() => {
            this.metrics.currentRPS = this.requestCounter;
            this.requestCounter = 0;
        }, 1000);

        // Health Check Loop
        setInterval(() => {
            this.updateMetrics();
            this.determineState();
        }, this.config.checkIntervalMs);
    }

    updateMetrics() {
        const cpus = os.cpus().length;
        const loadAvg = os.loadavg()[0]; // 1 minute average
        
        // Normalize CPU load (0 to 1+)
        this.metrics.cpuLoad = loadAvg / cpus;

        const mem = process.memoryUsage();
        // Heap used relative to typical Node limit (approx 1.5GB safe buffer for standard containers)
        const HEAP_LIMIT = 1024 * 1024 * 1024 * 1.5; 
        this.metrics.memoryUsage = mem.heapUsed / HEAP_LIMIT;
    }

    determineState() {
        const { cpuLoad, memoryUsage, currentRPS } = this.metrics;
        const { cpuThresholds, memThresholds, rpsThresholds } = this.config;

        let newState = 'GREEN';

        // Critical Check
        if (cpuLoad > cpuThresholds.red || memoryUsage > memThresholds.red || currentRPS > rpsThresholds.red) {
            newState = 'RED';
        } 
        // Warning Check
        else if (cpuLoad > cpuThresholds.yellow || memoryUsage > memThresholds.yellow || currentRPS > rpsThresholds.yellow) {
            newState = 'YELLOW';
        }

        // State Transition
        if (newState !== this.state) {
            console.log(`⚡ [ADAPTIVE] System State Changed: ${this.state} -> ${newState} | CPU: ${(cpuLoad*100).toFixed(1)}% | MEM: ${(memoryUsage*100).toFixed(1)}%`);
            this.state = newState;
            this.emit('stateChange', newState);
        }
    }

    // --- Public API for App Consumption ---

    // Called by Express Middleware
    trackRequest() {
        this.requestCounter++;
    }

    // Called by Socket Service
    setOnlineUsers(count) {
        this.activeUsers = count;
        this.metrics.activeConnections = count;
    }

    // Called by DB Manager
    reportDbLatency(ms) {
        // Simple moving average
        this.metrics.dbLatency = (this.metrics.dbLatency * 0.9) + (ms * 0.1);
    }

    // --- Decision Makers ---

    // For DB Manager: Should we throttle queries?
    getDbConcurrencyLimit() {
        const map = { GREEN: this.config.poolLimits.green, YELLOW: this.config.poolLimits.yellow, RED: this.config.poolLimits.red };
        return map[this.state];
    }

    // For Express Rate Limiter
    getCurrentRateLimit() {
        const map = { GREEN: this.config.rateLimits.green, YELLOW: this.config.rateLimits.yellow, RED: this.config.rateLimits.red };
        return map[this.state];
    }

    // For Response Compressor: Should we strip heavy metadata?
    isLightMode() {
        return this.state === 'RED';
    }

    // For Socket Service: Should we broadcast this event?
    shouldBroadcast(eventType) {
        if (this.state === 'GREEN') return true;
        
        // In YELLOW/RED, block low priority events
        const lowPriority = ['typing', 'presence', 'read_receipt'];
        if (lowPriority.includes(eventType)) {
            return this.state === 'YELLOW' ? Math.random() > 0.5 : false; // Drop 50% in Yellow, 100% in Red
        }
        return true;
    }

    getStatus() {
        return {
            state: this.state,
            metrics: this.metrics,
            onlineUsers: this.activeUsers
        };
    }
}

export const adaptiveSystem = new AdaptiveSystem();
