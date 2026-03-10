package com.numars.printagent

import io.ktor.http.HttpStatusCode
import io.ktor.serialization.gson.gson
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.engine.ApplicationEngine
import io.ktor.server.engine.embeddedServer
import io.ktor.server.cio.CIO
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing

class PrintAgentServer(
    private val tokenProvider: () -> String,
    private val macProvider: () -> String,
    private val bluetoothPrinterClient: BluetoothPrinterClient
) {
    private var engine: ApplicationEngine? = null

    fun start(port: Int = 19000) {
        if (engine != null) return

        engine = embeddedServer(CIO, port = port, host = "0.0.0.0") {
            install(ContentNegotiation) { gson() }
            routing {
                get("/health") {
                    call.respond(mapOf("ok" to true, "service" to "android-bluetooth-print-agent"))
                }

                post("/print/receipt") {
                    val expectedToken = tokenProvider().trim()
                    if (expectedToken.isNotEmpty()) {
                        val token = call.request.headers["x-print-agent-token"].orEmpty()
                        if (token != expectedToken) {
                            call.respond(HttpStatusCode.Unauthorized, mapOf("message" to "invalid print agent token"))
                            return@post
                        }
                    }

                    val request = call.receive<PrintReceiptRequest>()
                    val macAddress = macProvider().trim()
                    if (macAddress.isEmpty()) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("message" to "printer MAC belum diset"))
                        return@post
                    }

                    try {
                        val bytes = ReceiptEscPosMapper.toEscPos(request)
                        bluetoothPrinterClient.print(macAddress, bytes)
                        call.respond(mapOf("success" to true))
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.InternalServerError, mapOf("message" to (e.message ?: "print failed")))
                    }
                }
            }
        }

        engine?.start(wait = false)
    }

    fun stop() {
        engine?.stop(1000, 2000)
        engine = null
    }
}
