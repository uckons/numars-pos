package com.numars.printagent

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestBluetoothPermissionIfNeeded()

        val prefs = getSharedPreferences(PrintAgentService.PREFS_NAME, Context.MODE_PRIVATE)

        val tokenInput = EditText(this).apply { hint = "Token (x-print-agent-token)" }
        val macInput = EditText(this).apply { hint = "MAC printer bluetooth (contoh: 66:22:AA:BB:CC:DD)" }
        val portInput = EditText(this).apply { hint = "Port (default 19000)" }
        val status = TextView(this)

        tokenInput.setText(prefs.getString(PrintAgentService.KEY_TOKEN, ""))
        macInput.setText(prefs.getString(PrintAgentService.KEY_PRINTER_MAC, ""))
        portInput.setText(String.valueOf(prefs.getInt(PrintAgentService.KEY_PORT, PrintAgentService.DEFAULT_PORT)))

        val saveBtn = Button(this).apply {
            text = "Simpan Config"
            setOnClickListener {
                val port = portInput.text.toString().toIntOrNull() ?: PrintAgentService.DEFAULT_PORT
                prefs.edit()
                    .putString(PrintAgentService.KEY_TOKEN, tokenInput.text.toString())
                    .putString(PrintAgentService.KEY_PRINTER_MAC, macInput.text.toString())
                    .putInt(PrintAgentService.KEY_PORT, port)
                    .apply()
                status.text = "Config tersimpan."
            }
        }

        val startBtn = Button(this).apply {
            text = "Start Agent"
            setOnClickListener {
                ContextCompat.startForegroundService(this@MainActivity, Intent(this@MainActivity, PrintAgentService::class.java))
                val port = prefs.getInt(PrintAgentService.KEY_PORT, PrintAgentService.DEFAULT_PORT)
                status.text = "Agent berjalan di http://0.0.0.0:$port"
            }
        }

        val stopBtn = Button(this).apply {
            text = "Stop Agent"
            setOnClickListener {
                stopService(Intent(this@MainActivity, PrintAgentService::class.java))
                status.text = "Agent dihentikan"
            }
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 32)
            addView(tokenInput)
            addView(macInput)
            addView(portInput)
            addView(saveBtn)
            addView(startBtn)
            addView(stopBtn)
            addView(status)
        }

        setContentView(container)
    }

    private fun requestBluetoothPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.BLUETOOTH_CONNECT), 1001)
        }
    }
}
