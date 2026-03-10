# 🔧 Production Fix Implementation Guide

Panduan lengkap untuk mengimplementasikan semua fixes agar production-ready.

---

## 📋 Overview

| Phase | Issues | Files | Time | Priority |
|-------|--------|-------|------|----------|
| **Phase 1** | Bluetooth + Wakelock | 3 files | 3-4h | 🔴 CRITICAL |
| **Phase 2** | Print Queue + Logging | 2 files | 2-3h | 🟡 HIGH |
| **Phase 3** | Testing + Refinement | Tests | 2-3h | 🟠 MEDIUM |

---

## Phase 1: CRITICAL Fixes (3-4 Hours)

### Step 1.1: Update BluetoothPrinterClient.kt

**File:** `app/src/main/java/com/numars/printagent/BluetoothPrinterClient.kt`

**Current Issues:**
- ❌ No retry logic
- ❌ No connection pooling
- ❌ No timeout
- ❌ Blocks main thread

**Action:**
1. Backup original file
2. Replace dengan `BluetoothPrinterClient.kt.fixed`
3. Review changes

**Changes Summary:**
```kotlin
Before:
└─ fun print(macAddress: String, data: ByteArray)
   ├─ Create new socket every time
   └─ No retry/timeout

After:
├─ Connection pooling (reuse socket)
├─ Exponential backoff retry (3 attempts)
├─ Connection timeout (5 seconds)
├─ Thread-safe operations (@Synchronized)
└─ Result<Unit> return type
```

**Verification:**
```bash
# Check compilation
./gradlew compileDebugKotlin

# Should complete without errors
```

**Time:** 30-45 minutes

---

### Step 1.2: Update PrintAgentService.kt

**File:** `app/src/main/java/com/numars/printagent/PrintAgentService.kt`

**Current Issues:**
- ❌ No wakelock
- ❌ No Doze protection
- ❌ No keep-alive thread
- ❌ No proper lifecycle

**Action:**
1. Backup original file
2. Replace dengan `PrintAgentService.kt.fixed`
3. Review changes

**Key Changes:**
```kotlin
Before:
├─ Only START_STICKY
└─ No Doze protection
   └─ Will be suspended after 10 min idle

After:
├─ START_STICKY (auto-restart)
├─ PARTIAL_WAKE_LOCK (prevent Doze)
├─ Keep-alive thread (Bluetooth maintenance)
├─ Proper lifecycle (onCreate → onStartCommand → onDestroy)
└─ Comprehensive logging
```

**What Gets Fixed:**
1. ✅ Service no longer killed by Doze
2. ✅ Bluetooth connection maintained
3. ✅ HTTP server responsive even when idle
4. ✅ Auto-reconnect after device sleep

**Important Notes:**
- Wakelock drains ~5-10% battery per hour (acceptable for commercial use)
- Keep-alive thread runs every 30 seconds (lightweight)
- Thread-safe with proper synchronization

**Time:** 45-60 minutes

---

### Step 1.3: Update AndroidManifest.xml

**File:** `app/src/main/AndroidManifest.xml`

**Current Issues:**
- ❌ Missing WAKE_LOCK permission
- ❌ Missing BATTERY_OPTIMIZATION exempt

**Action:**
1. Add permissions:

```xml
<!-- Add these two new permissions -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

**Location:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Existing permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    
    <!-- ADD THESE: -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    
    <!-- Rest of manifest -->
</manifest>
```

**Verification:**
```bash
# Check manifest validity
./gradlew processDebugManifest

# Should complete without errors
```

**Time:** 15 minutes

---

### Phase 1 Verification

After completing all 3 steps:

```bash
# Full build to verify no errors
./gradlew clean assembleDebug

# Build time: ~5 minutes
# Expected: BUILD SUCCESSFUL
```

**Checklist:**
- [ ] BluetoothPrinterClient compiles
- [ ] PrintAgentService compiles
- [ ] AndroidManifest is valid
- [ ] Full build succeeds
- [ ] No warnings or errors

**Time:** Phase 1 Total = **3-4 hours**

---

## Phase 2: HIGH Priority Improvements (2-3 Hours)

### Step 2.1: Add Logging Framework

**Add dependency:**
```gradle
// app/build.gradle.kts
dependencies {
    implementation("io.github.microutils:kotlin-logging:3.0.5")
    implementation("ch.qos.logback:logback-android:0.1.5")
}
```

**Create logback.xml:**
```xml
<!-- app/src/main/res/raw/logback.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <appender name="LOGCAT" class="ch.qos.logback.classic.android.LogcatAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="DEBUG">
        <appender-ref ref="LOGCAT" />
    </root>

    <logger name="com.numars.printagent" level="DEBUG" />
</configuration>
```

**Update PrintAgentService.kt:**
```kotlin
import io.github.microutils.logging.KotlinLogging

class PrintAgentService : Service() {
    private val logger = KotlinLogging.logger {}
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            logger.info { "PrintAgentService starting" }
            // ... rest of code
        } catch (e: Exception) {
            logger.error(e) { "Failed to start service" }
        }
    }
}
```

**Time:** 45-60 minutes

---

### Step 2.2: Improve PrintAgentServer with Queue

**Current Issue:**
- HTTP requests are synchronous
- Slow print jobs block HTTP threads
- No job tracking

**Solution:**

```kotlin
// Add to PrintAgentServer.kt

class PrintAgentServer(
    private val tokenProvider: () -> String,
    private val macProvider: () -> String,
    private val bluetoothPrinterClient: BluetoothPrinterClient
) {
    private var engine: ApplicationEngine? = null
    private val logger = KotlinLogging.logger {}
    
    // Print job queue
    private val printQueue = mutableMapOf<String, PrintJob>()
    private var printWorker: Thread? = null
    
    fun start(port: Int = 19000) {
        if (engine != null) return
        
        startPrintWorker()
        
        engine = embeddedServer(CIO, port = port, host = "0.0.0.0") {
            install(ContentNegotiation) { gson() }
            routing {
                get("/health") {
                    call.respond(mapOf(
                        "ok" to true,
                        "service" to "android-bluetooth-print-agent",
                        "queue_size" to printQueue.size
                    ))
                }
                
                post("/print/receipt") {
                    try {
                        // Validation
                        val expectedToken = tokenProvider().trim()
                        if (expectedToken.isNotEmpty()) {
                            val token = call.request.headers["x-print-agent-token"].orEmpty()
                            if (token != expectedToken) {
                                call.respond(HttpStatusCode.Unauthorized, 
                                    mapOf("message" to "invalid token"))
                                return@post
                            }
                        }
                        
                        val request = call.receive<PrintReceiptRequest>()
                        val macAddress = macProvider().trim()
                        
                        if (macAddress.isEmpty()) {
                            call.respond(HttpStatusCode.BadRequest,
                                mapOf("message" to "printer MAC not set"))
                            return@post
                        }
                        
                        // Queue job instead of executing
                        val jobId = enqueuePrintJob(request, macAddress)
                        logger.info { "Print job queued: $jobId" }
                        
                        call.respond(HttpStatusCode.Accepted, mapOf(
                            "job_id" to jobId,
                            "status" to "queued"
                        ))
                        
                    } catch (e: Exception) {
                        logger.error(e) { "Error processing print request" }
                        call.respond(HttpStatusCode.InternalServerError,
                            mapOf("message" to (e.message ?: "unknown error")))
                    }
                }
                
                get("/print/jobs/{job_id}") {
                    val jobId = call.parameters["job_id"] ?: return@get
                    val job = printQueue[jobId]
                    
                    if (job == null) {
                        call.respond(HttpStatusCode.NotFound, 
                            mapOf("message" to "job not found"))
                        return@get
                    }
                    
                    call.respond(mapOf(
                        "id" to job.id,
                        "status" to job.status,
                        "error" to job.error,
                        "created_at" to job.createdAt
                    ))
                }
            }
        }
        
        engine?.start(wait = false)
        logger.info { "HTTP server started on port $port" }
    }
    
    private fun enqueuePrintJob(request: PrintReceiptRequest, mac: String): String {
        val jobId = UUID.randomUUID().toString()
        val job = PrintJob(
            id = jobId,
            request = request,
            macAddress = mac,
            status = "queued",
            error = null,
            createdAt = System.currentTimeMillis()
        )
        synchronized(printQueue) {
            printQueue[jobId] = job
        }
        return jobId
    }
    
    private fun startPrintWorker() {
        if (printWorker?.isAlive == true) return
        
        printWorker = Thread {
            logger.info { "Print worker started" }
            while (!Thread.currentThread().isInterrupted) {
                try {
                    val job = synchronized(printQueue) {
                        printQueue.values.firstOrNull { it.status == "queued" }
                    }
                    
                    if (job != null) {
                        job.status = "processing"
                        try {
                            val bytes = ReceiptEscPosMapper.toEscPos(job.request)
                            val result = bluetoothPrinterClient.print(job.macAddress, bytes)
                            
                            if (result.isSuccess) {
                                job.status = "success"
                                logger.info { "Print job success: ${job.id}" }
                            } else {
                                job.status = "failed"
                                job.error = result.exceptionOrNull()?.message
                                logger.error { "Print job failed: ${job.id}" }
                            }
                        } catch (e: Exception) {
                            job.status = "failed"
                            job.error = e.message
                            logger.error(e) { "Print job error: ${job.id}" }
                        }
                    } else {
                        Thread.sleep(100)  // No jobs, wait before checking again
                    }
                } catch (e: InterruptedException) {
                    break
                } catch (e: Exception) {
                    logger.error(e) { "Print worker error" }
                    Thread.sleep(1000)
                }
            }
            logger.info { "Print worker stopped" }
        }.apply {
            isDaemon = true
            name = "PrintWorkerThread"
        }
        
        printWorker?.start()
    }
    
    fun stop() {
        printWorker?.interrupt()
        
        // Wait for pending jobs
        val maxWaitTime = 5000
        val startTime = System.currentTimeMillis()
        while (printQueue.any { it.value.status == "processing" }) {
            if (System.currentTimeMillis() - startTime > maxWaitTime) break
            Thread.sleep(100)
        }
        
        engine?.stop(gracePeriodMillis = 2000, timeoutMillis = 5000)
        engine = null
        bluetoothPrinterClient.disconnect()
        logger.info { "Server stopped" }
    }
}

data class PrintJob(
    val id: String,
    val request: PrintReceiptRequest,
    val macAddress: String,
    var status: String,  // queued, processing, success, failed
    var error: String?,
    val createdAt: Long
)
```

**Time:** 60-90 minutes

---

## Phase 2 Verification

```bash
# Compile with new features
./gradlew clean assembleDebug

# Expected: BUILD SUCCESSFUL

# Test on device
adb install -r app/build/outputs/apk/debug/app-debug.apk

# In app:
# 1. Fill config (token, MAC, port)
# 2. Start Agent
# 3. Monitor logcat:
#    adb logcat | grep PrintAgent
```

**Expected Logs:**
```
PrintAgentService starting
Wakelock acquired
Keep-alive thread started
HTTP server started on port 19000
Print job queued: uuid
Print worker started
Print job success: uuid
```

**Time:** Phase 2 Total = **2-3 hours**

---

## Phase 3: Testing & Validation (2-3 Hours)

### Step 3.1: Unit Tests

Create `PrintAgentTest.kt`:

```kotlin
import org.junit.Test
import org.junit.Before
import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.InstrumentationRegistry
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PrintAgentServiceTest {
    
    private lateinit var context: Context
    
    @Before
    fun setUp() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
    }
    
    @Test
    fun testServiceStartsSuccessfully() {
        val intent = Intent(context, PrintAgentService::class.java)
        context.startService(intent)
        
        // Give service time to start
        Thread.sleep(2000)
        
        // Verify service is running
        // (Implementation depends on your testing framework)
    }
    
    @Test
    fun testBluetoothRetryLogic() {
        val client = BluetoothPrinterClient(context)
        
        // Should fail gracefully with retry
        val result = client.print("FF:FF:FF:FF:FF:FF", byteArrayOf(1, 2, 3))
        
        assert(result.isFailure)
    }
    
    @Test
    fun testWakelockAcquired() {
        // Verify wakelock is being held
        // (Requires reflection or mocking)
    }
}
```

**Time:** 45-60 minutes

---

### Step 3.2: Integration Testing

**Manual Test Checklist:**

```
1. Service Lifecycle
  [ ] Service starts when user clicks "Start Agent"
  [ ] Service shows in foreground notification
  [ ] Service can be stopped cleanly
  [ ] Service auto-restarts if killed

2. Bluetooth Functionality
  [ ] Connects to actual printer
  [ ] Prints successfully
  [ ] Retries on connection failure
  [ ] Disconnects cleanly

3. HTTP Endpoints
  [ ] GET /health returns OK
  [ ] POST /print/receipt queues job
  [ ] GET /print/jobs/{id} returns status
  [ ] Token validation works

4. Doze & Battery
  [ ] Service stays active when device sleeps
  [ ] Prints work even if device was idle
  [ ] Logcat shows keep-alive pings
  [ ] Wakelock is held

5. Error Handling
  [ ] Service handles Bluetooth disconnect gracefully
  [ ] Print job retries on failure
  [ ] Error messages logged to logcat
  [ ] HTTP returns proper error codes

6. Stress Testing
  [ ] 100 concurrent print requests
  [ ] Device sleep/wake cycles
  [ ] Network disconnects
  [ ] Printer disconnect/reconnect
```

**Time:** 60-90 minutes

---

## 📝 Deployment Checklist

Before releasing to production:

```
Testing
  [ ] All unit tests passing
  [ ] Manual integration tests passing
  [ ] Stress testing 1000+ jobs
  [ ] 24-hour stability test (device running)
  [ ] Bluetooth reconnection scenarios tested
  [ ] Network failure scenarios tested
  [ ] Doze mode tested explicitly

Code Quality
  [ ] No lint warnings
  [ ] ProGuard minification enabled (for release)
  [ ] Logging configured properly
  [ ] Error handling comprehensive
  [ ] No hardcoded values

Security
  [ ] Token validation working
  [ ] Bluetooth MAC validation
  [ ] No credentials in code
  [ ] Permissions properly declared

Documentation
  [ ] Code comments added
  [ ] README updated
  [ ] API documentation complete
  [ ] Troubleshooting guide created
  [ ] Deployment procedure documented

Build
  [ ] Debug APK builds successfully
  [ ] Release APK builds successfully
  [ ] Signed APK ready
  [ ] Version code incremented
  [ ] Version name updated
```

---

## 🚀 Implementation Timeline

```
Day 1 (4-5 hours):
├─ Morning:   Phase 1 Critical Fixes
│  ├─ BluetoothPrinterClient.kt (1h)
│  ├─ PrintAgentService.kt (1h)
│  └─ AndroidManifest.xml (0.5h)
└─ Afternoon: Phase 1 Testing
   └─ Build & initial testing (1.5-2h)

Day 2 (3-4 hours):
├─ Morning: Phase 2 HIGH Improvements
│  ├─ Logging framework (1h)
│  └─ Print Queue (1.5h)
└─ Afternoon: Integration testing
   └─ Manual testing (1-1.5h)

Day 3 (2-3 hours):
├─ Morning: Stress testing
│  └─ 1000+ job stress test (1h)
├─ Afternoon: Bug fixes
│  └─ Address any issues (1-2h)
└─ Final: Deployment prep
   └─ Documentation & checklist (0.5h)
```

**Total:** 3 days (9-12 hours work)

---

## ✅ Success Criteria

After implementation, verify:

```
Service Stability
  ✅ Service never killed when idle
  ✅ Auto-restarts if killed
  ✅ Stays responsive to HTTP requests
  ✅ Bluetooth connection maintained

Error Handling
  ✅ Prints retry on failure
  ✅ All errors logged properly
  ✅ Graceful degradation
  ✅ No crashes

Performance
  ✅ 100+ concurrent requests handled
  ✅ No memory leaks
  ✅ Wakelock drain < 15% per hour
  ✅ Keep-alive overhead minimal

Production Ready
  ✅ Can ship to production
  ✅ Can be supported
  ✅ Monitoring in place
  ✅ Rollback procedure documented
```

---

## 🆘 Troubleshooting

If issues arise during implementation:

**Wakelock not acquiring:**
```
Check:
- Permission WAKE_LOCK added to manifest
- PowerManager available
- Try/catch blocks covering exceptions
```

**Keep-alive thread not running:**
```
Check:
- Thread.start() is called
- isRunning flag is set to true
- No exception in thread loop
```

**Bluetooth connection still failing:**
```
Check:
- Retry logic is being called
- Connection timeout is not too short
- MAC address format correct (XX:XX:XX:XX:XX:XX)
- Permissions granted at runtime
```

**HTTP server hanging:**
```
Check:
- Print worker thread is running
- Jobs are being dequeued
- No synchronization deadlock
- Request timeout set properly
```

---

## Next Steps

1. ✅ Implement Phase 1 (this week)
2. ✅ Test thoroughly (this week)
3. ✅ Deploy to production (next week)
4. ✅ Monitor in production (ongoing)

Good luck! 🚀
