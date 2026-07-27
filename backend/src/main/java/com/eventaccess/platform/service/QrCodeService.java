package com.eventaccess.platform.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Base64;

@Service
public class QrCodeService {
    private final String appBaseUrl;

    public QrCodeService(@Value("${app.base-url}") String appBaseUrl) {
        this.appBaseUrl = appBaseUrl.replaceAll("/+$", "");
    }

    public String ticketUrl(String token) {
        return appBaseUrl + "/t/" + token;
    }

    public String dataUrl(String value, int size) {
        try {
            BitMatrix matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, size, size);
            var output = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", output);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        } catch (Exception ex) {
            throw new IllegalStateException("Falha ao gerar QR Code", ex);
        }
    }
}
