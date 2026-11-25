// Mirror of the exception declared in app/.../network/ProductApiClient.kt (that file pulls in OkHttp
// and Android APIs). Keep the constructor in sync if it changes there.
package com.thesis.mobile.network

class ProductApiException(
    val code: Int,
    override val message: String,
    val errorCode: String? = null,
    val feature: String? = null
) : RuntimeException(message)
