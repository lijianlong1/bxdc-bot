package com.lobsterai.skillgateway.exception;

/**
 * Raised when {@code systemAdminPassword} is missing or does not match the configured gate.
 */
public class RegistrationNotAllowedException extends RuntimeException {
    public RegistrationNotAllowedException() {
        super();
    }
}
