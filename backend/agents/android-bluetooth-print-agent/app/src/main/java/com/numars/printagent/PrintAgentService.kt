package com.numars.printagent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

class PrintAgentService : Service() {
    private lateinit var server: PrintAgentServer

    override fun onCreate() {
        super.onCreate()
        createChannel()

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val client = BluetoothPrinterClient(this)
        server = PrintAgentServer(
            tokenProvider = { prefs.getString(KEY_TOKEN, "").orEmpty() },
            macProvider = { prefs.getString(KEY_PRINTER_MAC, "").orEmpty() },
            bluetoothPrinterClient = client
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val port = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getInt(KEY_PORT, DEFAULT_PORT)
        startForeground(NOTIF_ID, buildNotification(port))
        server.start(port)
        return START_STICKY
    }

    override fun onDestroy() {
        server.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Print Agent", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(port: Int): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("Numars Print Agent aktif")
            .setContentText("Listening di port $port")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .build()
    }

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
