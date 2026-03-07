plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.numars.printagent"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.numars.printagent"
    minSdk = 26
    targetSdk = 34
    versionCode = 1
    versionName = "0.1.0-poc"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")

  implementation("io.ktor:ktor-server-core:2.3.12")
  implementation("io.ktor:ktor-server-cio:2.3.12")
  implementation("io.ktor:ktor-server-content-negotiation:2.3.12")
  implementation("io.ktor:ktor-serialization-gson:2.3.12")
}
