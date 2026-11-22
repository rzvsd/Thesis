package com.thesis.mobile.billing

import android.app.Activity
import android.content.Context
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offerings
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.PackageType
import com.revenuecat.purchases.PurchaseParams
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.revenuecat.purchases.awaitOfferings
import com.revenuecat.purchases.awaitPurchase
import com.revenuecat.purchases.awaitRestore
import com.thesis.mobile.BuildConfig

object RevenueCatBilling {
    fun isEnabled(): Boolean = BuildConfig.REVENUECAT_PUBLIC_ANDROID_KEY.isNotBlank()

    suspend fun configureIfPossible(context: Context, appUserId: String?): Boolean {
        if (!isEnabled()) {
            return false
        }

        if (!Purchases.isConfigured) {
            val builder = PurchasesConfiguration.Builder(
                context.applicationContext,
                BuildConfig.REVENUECAT_PUBLIC_ANDROID_KEY
            )
            if (!appUserId.isNullOrBlank()) {
                builder.appUserID(appUserId.trim())
            }
            Purchases.configure(builder.build())
            return true
        }

        if (!appUserId.isNullOrBlank() && appUserId.trim() != Purchases.sharedInstance.appUserID) {
            logIn(appUserId.trim())
        }
        return true
    }

    suspend fun getOfferings(): Offerings {
        ensureConfigured()
        return Purchases.sharedInstance.awaitOfferings()
    }

    suspend fun purchase(activity: Activity, selectedPackage: Package): CustomerInfo {
        ensureConfigured()
        val params = PurchaseParams.Builder(activity, selectedPackage).build()
        return Purchases.sharedInstance.awaitPurchase(params).customerInfo
    }

    suspend fun restorePurchases(): CustomerInfo {
        ensureConfigured()
        return Purchases.sharedInstance.awaitRestore()
    }

    suspend fun logOutSafely() {
        if (!Purchases.isConfigured) {
            return
        }
        runCatching { Purchases.sharedInstance.logOut() }
    }

    private fun logIn(appUserId: String) {
        ensureConfigured()
        Purchases.sharedInstance.logIn(appUserId)
    }

    fun pickPreferredPackage(offerings: Offerings, preference: PackageType): Package? {
        val current = offerings.current ?: return null
        // Store product IDs come from build config; Play IDs look like "productId:basePlanId".
        val configuredProductId = when (preference) {
            PackageType.MONTHLY -> BuildConfig.REVENUECAT_MONTHLY_PRODUCT_ID
            PackageType.ANNUAL -> BuildConfig.REVENUECAT_YEARLY_PRODUCT_ID
            else -> ""
        }.trim()
        if (configuredProductId.isNotEmpty()) {
            current.availablePackages.firstOrNull {
                it.product.id == configuredProductId || it.product.id.substringBefore(':') == configuredProductId
            }?.let { return it }
        }
        return current.availablePackages.firstOrNull { it.packageType == preference }
            ?: current.availablePackages.firstOrNull()
    }

    private fun ensureConfigured() {
        check(Purchases.isConfigured) {
            "RevenueCat is not configured. Set REVENUECAT_PUBLIC_ANDROID_KEY and login first."
        }
    }
}
