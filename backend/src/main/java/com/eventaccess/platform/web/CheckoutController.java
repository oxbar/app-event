package com.eventaccess.platform.web;

import com.eventaccess.platform.service.CheckoutService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CheckoutController {
    private final CheckoutService checkout;

    public CheckoutController(CheckoutService checkout) {
        this.checkout = checkout;
    }

    @PostMapping("/public/events/{eventId}/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    CheckoutService.OrderView checkout(@PathVariable UUID eventId,
                                       @Valid @RequestBody CheckoutService.CheckoutRequest request) {
        return checkout.checkout(eventId, request);
    }

    @PostMapping("/public/orders/{code}/payments/pix")
    CheckoutService.PaymentView pix(@PathVariable String code) {
        return checkout.createPix(code);
    }

    @GetMapping("/public/tickets/{token}")
    CheckoutService.TicketView ticket(@PathVariable String token) {
        return checkout.publicTicket(token);
    }

    @GetMapping("/public/orders/{code}")
    CheckoutService.OrderView order(@PathVariable String code) {
        return checkout.status(code);
    }

    @GetMapping("/public/orders/{code}/payment-status")
    CheckoutService.OrderView status(@PathVariable String code) {
        return checkout.status(code);
    }
}
