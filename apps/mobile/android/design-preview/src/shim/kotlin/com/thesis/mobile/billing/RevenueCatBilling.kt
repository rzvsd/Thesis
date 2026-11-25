package com.thesis.mobile.billing

/** Preview stand-in: toggle with -Dpreview.billing=true to see the store-backed paywall copy. */
object RevenueCatBilling {
    fun isEnabled(): Boolean = System.getProperty("preview.billing", "false").toBoolean()
}
