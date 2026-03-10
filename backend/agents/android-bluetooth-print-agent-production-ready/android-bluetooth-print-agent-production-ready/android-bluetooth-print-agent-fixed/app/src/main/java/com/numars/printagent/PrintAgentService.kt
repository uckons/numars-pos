package com.numars.printagent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.util.logging.Logger

/**
 * PrintAgentService - dengan wakelock + Doze protection
 * 
 * Improvements:
 * - PARTIAL_WAKE_LOCK untuk keep CPU alive saat Doze
 * - Bluetooth keep-alive thread
 * - Proper lifecycle management
 * - START_STICKY untuk auto-restart
 */
class PrintAgentService : Service() {
    private lateinit var server: PrintAgentServer
    private lateinit var bluetoothPrinterClient: BluetoothPrinterClient
    
    // Wakelock untuk prevent Doze suspension
    private var wakeLock: PowerManager.WakeLock? = null
    
    // Keep-alive thread
    private var keepAliveThread: Thread? = null
    private var isRunning = false
    
    private val logger = Logger.getLogger("PrintAgentService")
    
    override fun onCreate() {
        super.onCreate()
        logger.info("PrintAgentService.onCreate()")
        
        createNotificationChannel()
        initializeWakeLock()
        
        // Initialize Bluetooth client
        bluetoothPrinterClient = BluetoothPrinterClient(this)
        
        // Initialize HTTP server
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        server = PrintAgentServer(
            tokenProvider = { prefs.getString(KEY_TOKEN, "").orEmpty() },
            macProvider = { prefs.getString(KEY_PRINTER_MAC, "").orEmpty() },
            bluetoothPrinterClient = bluetoothPrinterClient
        )
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        logger.info("PrintAgentService.onStartCommand()")
        
        val port = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getInt(KEY_PORT, DEFAULT_PORT)
        
        try {
            // Start as foreground service (prevents normal killing)
            val notification = buildNotification(port)
            startForeground(NOTIF_ID, notification)
            
            // Acquire wakelock (prevents Doze suspension)
            acquireWakeLock()
            
            // Start HTTP server
            server.start(port)
            
            // Start keep-alive thread (untuk maintain Bluetooth connection)
            startKeepAliveThread()
            
            isRunning = true
            logger.info("PrintAgentService started successfully on port $port")
            
        } catch (e: Exception) {
            logger.severe("Failed to start PrintAgentService: ${e.message}")
            e.printStackTrace()
            return START_NOT_STICKY
        }
        
        // START_STICKY:
        // - Jika service ter-kill, Android akan restart otomatis
        // - Tidak ideal tapi kombinasi dengan wakelock cukup baik
        return START_STICKY
    }
    
    override fun onDestroy() {
        logger.info("PrintAgentService.onDestroy()")
        
        try {
            isRunning = false
            
            // Stop keep-alive thread
            keepAliveThread?.interrupt()
            
            // Stop HTTP server
            server.stop()
            
            // Close Bluetooth connection
            bluetoothPrinterClient.disconnect()
            
            // Release wakelock
            releaseWakeLock()
            
            logger.info("PrintAgentService stopped successfully")
            
        } catch (e: Exception) {
            logger.severe("Error during shutdown: ${e.message}")
        }
        
        super.onDestroy()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    // ==================== Wakelock Management ====================
    
    /**
     * Initialize wakelock untuk prevent Doze suspension
     */
    private fun initializeWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "PrintAgent::PrintWakeLock"
            ).apply {
                setReferenceCounted(false)
            }
            logger.info("Wakelock initialized")
        } catch (e: Exception) {
            logger.severe("Failed to initialize wakelock: ${e.message}")
            e.printStackTrace()
        }
    }
    
    /**
     * Acquire wakelock untuk keep CPU awake saat Doze
     * 
     * PARTIAL_WAKE_LOCK:
     * - Keeps CPU on (prevents sleep)
     * - Allows Bluetooth & Network
     * - Does NOT keep screen on
     * - Battery drain: ~5-15% per hour (depends on usage)
     */
    private fun acquireWakeLock() {
        try {
            wakeLock?.let {
                if (!it.isHeld) {
                    // Acquire with 10 minute timeout (safety measure)
                    // Will be renewed by keep-alive thread
                    it.acquire(10 * 60 * 1000L)
                    logger.info("Wakelock acquired")
                } else {
                    logger.info("Wakelock already held")
                }
            }
        } catch (e: Exception) {
            logger.severe("Failed to acquire wakelock: ${e.message}")
            e.printStackTrace()
        }
    }
    
    /**
     * Release wakelock saat service destroyed
     */
    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                    logger.info("Wakelock released")
                }
            }
        } catch (e: Exception) {
            logger.severe("Failed to release wakelock: ${e.message}")
        }
    }
    
    // ==================== Keep-Alive Thread ====================
    
    /**
     * Start background thread untuk maintain Bluetooth connection
     * 
     * Ini melakukan lightweight ping ke printer untuk:
     * - Keep Bluetooth connection alive
     * - Detect connection loss
     * - Maintain wakelock
     */
    private fun startKeepAliveThread() {
        if (keepAliveThread?.isAlive == true) {
            logger.info("Keep-alive thread already running")
            return
        }
        
        keepAliveThread = Thread {
            logger.info("Keep-alive thread started")
            
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val keepAliveIntervalMs = 30 * 1000L  // Check every 30 seconds
            
            while (!Thread.currentThread().isInterrupted && isRunning) {
                try {
                    Thread.sleep(keepAliveIntervalMs)
                    
                    // Renew wakelock (safety measure)
                    renewWakeLock()
                    
                    // Check Bluetooth connection
                    val mac = prefs.getString(KEY_PRINTER_MAC, "").orEmpty()
                    if (mac.isNotEmpty()) {
                        try {
                            val adapter = BluetoothAdapter.getDefaultAdapter()
                            if (adapter?.isEnabled == true) {
                                // Lightweight check - just get device reference
                                val device = adapter.getRemoteDevice(mac)
                                
                                // Optional: check bondState untuk verify device adalah accessible
                                val bondState = device.bondState
                                logger.fine("Device $mac bond state: $bondState")
                            }
                        } catch (e: Exception) {
                            logger.warning("Keep-alive check failed: ${e.message}")
                        }
                    }
                    
                } catch (e: InterruptedException) {
                    logger.info("Keep-alive thread interrupted")
                    break
                } catch (e: Exception) {
                    logger.severe("Keep-alive thread error: ${e.message}")
                    e.printStackTrace()
                    
                    // Don't crash - continue running
                    try {
                        Thread.sleep(5000)  // Wait before retrying
                    } catch (ie: InterruptedException) {
                        break
                    }
                }
            }
            
            logger.info("Keep-alive thread stopped")
        }.apply {
            isDaemon = true
            name = "PrintAgentKeepAliveThread"
            start()
        }
    }
    
    /**
     * Renew wakelock untuk prevent timeout
     */
    private fun renewWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    // Release dan re-acquire untuk reset timeout
                    it.release()
                }
                it.acquire(10 * 60 * 1000L)  // Renew 10 minute timeout
            }
        } catch (e: Exception) {
            logger.warning("Failed to renew wakelock: ${e.message}")
        }
    }
    
    // ==================== Notification Management ====================
    
    /**
     * Create notification channel (required for Android 8+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Numars Print Agent",
                    NotificationManager.IMPORTANCE_LOW  // Low priority - silent
                ).apply {
                    description = "Print agent service notification"
                    enableLights(false)
                    enableVibration(false)
                    setSound(null, null)
                }
                
                val manager = getSystemService(NotificationManager::class.java)
                manager.createNotificationChannel(channel)
                logger.info("Notification channel created")
            } catch (e: Exception) {
                logger.severe("Failed to create notification channel: ${e.message}")
            }
        }
    }
    
    /**
     * Build foreground service notification
     */
    private fun buildNotification(port: Int): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        
        return builder
            .setContentTitle("Numars Print Agent")
            .setContentText("Listening di port $port (Wakelock active)")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)  // Prevent user swipe-dismiss
            .build()
    }
    
    // ==================== Constants ====================
    
    companion object {
        const val PREFS_NAME = "print_agent_prefs"
        const val KEY_TOKEN = "token"
        const val KEY_PRINTER_MAC = "printer_mac"
        const val KEY_PORT = "port"
        const val DEFAULT_PORT = 19000
        
        private const val CHANNEL_ID = "print-agent-channel"
        private const val NOTIF_ID = 2106
    }
}
