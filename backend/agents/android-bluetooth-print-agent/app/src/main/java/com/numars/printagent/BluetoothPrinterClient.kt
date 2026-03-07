package com.numars.printagent

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import java.util.UUID

class BluetoothPrinterClient(private val context: Context) {
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    fun print(macAddress: String, data: ByteArray) {
        ensureBluetoothPermission()
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("Bluetooth adapter tidak tersedia")

        val device: BluetoothDevice = adapter.getRemoteDevice(macAddress)
        val socket = device.createRfcommSocketToServiceRecord(sppUuid)

        socket.connect()
        socket.outputStream.use { stream ->
            stream.write(data)
            stream.flush()
        }
        socket.close()
    }

    private fun ensureBluetoothPermission() {
        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED

        if (!granted) {
            throw SecurityException("BLUETOOTH_CONNECT belum diizinkan")
        }
    }
}
