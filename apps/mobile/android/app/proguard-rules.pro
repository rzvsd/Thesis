# M9 hardening baseline rules.

# Keep model classes used in JSON mapping where field names are expected at runtime.
-keep class com.thesis.mobile.model.** { *; }

# Keep Room generated implementation classes.
-keep class * extends androidx.room.RoomDatabase
-keep class androidx.room.RoomDatabase_Impl

# Keep Firebase Messaging service.
-keep class com.thesis.mobile.push.ThesisFirebaseMessagingService { *; }

# Keep RevenueCat public APIs.
-keep class com.revenuecat.** { *; }
-dontwarn com.revenuecat.**

# Keep WorkManager workers.
-keep class * extends androidx.work.ListenableWorker { *; }
