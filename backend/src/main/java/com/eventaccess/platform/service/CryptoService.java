package com.eventaccess.platform.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

@Service
public class CryptoService {
    private final byte[] qrSecret;
    public CryptoService(@Value("${app.qr.secret}") String secret){ this.qrSecret=secret.getBytes(StandardCharsets.UTF_8); }
    public String ticketToken(java.util.UUID id,String publicCode){ return base64(hmac(id+":"+publicCode)); }
    public String sha256(String value){ try{return hex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);} }
    public String randomToken(){ byte[] b=new byte[32]; new java.security.SecureRandom().nextBytes(b); return base64(b); }
    private byte[] hmac(String v){ try{Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(qrSecret,"HmacSHA256"));return mac.doFinal(v.getBytes(StandardCharsets.UTF_8));}catch(Exception e){throw new IllegalStateException(e);} }
    private String base64(byte[] b){return Base64.getUrlEncoder().withoutPadding().encodeToString(b);} private String hex(byte[] b){return java.util.HexFormat.of().formatHex(b);}
}
