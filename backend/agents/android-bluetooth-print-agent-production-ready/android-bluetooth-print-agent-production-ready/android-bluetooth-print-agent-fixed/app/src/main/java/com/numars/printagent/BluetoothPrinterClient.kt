package com.numars.printagent

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import java.io.IOException
import java.util.UUID

/**
 * BluetoothPrinterClient - dengan retry logic, connection pooling, dan timeout handling
 * 
 * Improvements:
 * - Connection pooling (reuse socket)
 * - Exponential backoff retry
 * - Connection timeout
 * - Proper error handling
 * - Thread-safe operations
 */
class BluetoothPrinterClient(private val context: Context) {
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    
    // Configuration
    private val connectionTimeoutMs = 5000L
    private val maxRetries = 3
    private val baseRetryDelayMs = 1000L
    
    // Connection pooling
    private var socket: BluetoothSocket? = null
    private var lastConnectedMac: String? = null
    
    /**
     * Print data to Bluetooth printer with retry logic
     * 
     * @param macAddress Printer MAC address (format: "66:22:AA:BB:CC:DD")
     * @param data ESC/POS byte array
     * @return Result<Unit> - success or error with message
     */
    @Synchronized
    fun print(macAddress: String, data: ByteArray): Result<Unit> {
        if (macAddress.isBlank()) {
            return Result.failure(IllegalArgumentException("MAC address cannot be blank"))
        }
        
        if (data.isEmpty()) {
            return Result.failure(IllegalArgumentException("Data cannot be empty"))
        }
        
        var lastError: Exception? = null
        
        // Retry logic dengan exponential backoff
        repeat(maxRetries) { attempt ->
            try {
                // Ensure connection is valid
                if (!isConnected(macAddress)) {
                    disconnect()
                    connect(macAddress)
                }
                
                // Write data to printer
                socket?.outputStream?.use { stream ->
                    stream.write(data)
                    stream.flush()
                }
                
                return Result.success(Unit)
                
            } catch (e: SecurityException) {
                // Bluetooth permission not granted
                return Result.failure(e)
                
            } catch (e: Exception) {
                lastError = e
                disconnect()  // Reset connection for next retry
                
                // Don't retry on last attempt
                if (attempt < maxRetries - 1) {
                    val delayMs = baseRetryDelayMs * (attempt + 1)  // Exponential backoff: 1s, 2s, 3s
                    try {
                        Thread.sleep(delayMs)
                    } catch (ie: InterruptedException) {
                        return Result.failure(Exception("Interrupted during retry"))
                    }
                }
            }
        }
        
        val errorMsg = lastError?.message ?: "Unknown error"
        return Result.failure(Exception("Print failed after $maxRetries attempts: $errorMsg", lastError))
    }
    
    /**
     * Check jika socket sudah connected ke device yang tepat
     */
    @Synchronized
    private fun isConnected(macAddress: String): Boolean {
        return try {
            socket?.isConnected == true && lastConnectedMac == macAddress
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * Connect ke printer Bluetooth dengan timeout
     */
    @Synchronized
    private fun connect(macAddress: String) {
        ensureBluetoothPermission()
        
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("Bluetooth adapter tidak tersedia")
        
        if (!adapter.isEnabled) {
            throw IOException("Bluetooth tidak aktif")
        }
        
        try {
            val device: BluetoothDevice = adapter.getRemoteDevice(macAddress)
            
            // Create socket dengan timeout
            val newSocket = device.createRfcommSocketToServiceRecord(sppUuid)
            
            // Try to connect dengan timeout
            var connectionSuccess = false
            val connectionThread = Thread {
                try {
                    newSocket.connect()
                    connectionSuccess = true
                } catch (e: IOException) {
                    // Connection failed, exception akan di-handle di main thread
                }
            }
            
            connectionThread.start()
            connectionThread.join(connectionTimeoutMs)
            
            if (!connectionSuccess) {
                newSocket.close()
                throw IOException("Connection timeout setelah ${connectionTimeoutMs}ms")
            }
            
            socket = newSocket
            lastConnectedMac = macAddress
            
        } catch (e: IOException) {
            socket = null
            lastConnectedMac = null
            throw e
        }
    }
    
    /**
     * Disconnect dari printer dan close socket
     */
    @Synchronized
    fun disconnect() {
        try {
            socket?.close()
        } catch (e: Exception) {
            // Ignore close errors
        }
        socket = null
        lastConnectedMac = null
    }
    
    /**
     * Ensure Bluetooth permission is granted (required for Android 12+)
     */
    private fun ensureBluetoothPermission() {
        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED
        
        if (!granted) {
            throw SecurityException("BLUETOOTH_CONNECT permission belum diizinkan")
        }
    }
}
