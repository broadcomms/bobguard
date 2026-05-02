# Threat Model Delta - PR #1

## Overview

This PR introduces multiple new attack surfaces and threat vectors by implementing authentication, patient data management, and messaging endpoints without proper HIPAA safeguards.

## New Threat Vectors

### 1. Unencrypted PHI at Rest (§164.312(a)(2)(iv))

**Threat**: Database compromise exposes plaintext PHI

**Attack Scenario**: An attacker gains read access to the PostgreSQL database (via SQL injection, credential theft, or infrastructure breach). All patient PHI (dob, mrn, ssn, clinical notes) is immediately readable without decryption.

**Impact**: 
- Direct HIPAA breach notification requirement
- Potential identity theft for all patients
- Medical record tampering risk
- Regulatory penalties

**Likelihood**: HIGH (databases are frequent attack targets)

**Risk Score**: CRITICAL

---

### 2. Missing Audit Trail (§164.312(b))

**Threat**: Unauthorized PHI access goes undetected

**Attack Scenario**: An insider or compromised account accesses patient records. Without audit logging, there is no forensic trail to detect the breach, identify affected patients, or support incident response.

**Impact**:
- Inability to detect ongoing breaches
- No evidence for breach notification scope
- Regulatory non-compliance
- Loss of accountability

**Likelihood**: MEDIUM (requires initial access, but undetectable)

**Risk Score**: HIGH

---

### 3. Single-Factor Authentication (§164.312(d))

**Threat**: Credential compromise grants full PHI access

**Attack Scenario**: An attacker obtains a valid JWT token (via phishing, token theft, or session hijacking). With no MFA gate, the token alone grants full access to all patient endpoints.

**Impact**:
- Unauthorized PHI access
- Data exfiltration
- Record modification/deletion
- Impersonation attacks

**Likelihood**: MEDIUM (JWT tokens are bearer tokens, vulnerable to theft)

**Risk Score**: HIGH

---

### 4. Plain HTTP Transmission (§164.312(e)(1))

**Threat**: PHI intercepted in transit

**Attack Scenario**: The `/messages/inbound` webhook accepts plain HTTP requests. An attacker performing network interception (MITM, DNS spoofing, or compromised network infrastructure) can read PHI in transit.

**Impact**:
- PHI disclosure to unauthorized parties
- Message tampering
- Replay attacks
- Regulatory violation

**Likelihood**: MEDIUM (depends on network position)

**Risk Score**: HIGH

---

### 5. Hard Delete Without Integrity Protection (§164.312(c)(1))

**Threat**: Malicious or accidental data destruction

**Attack Scenario**: The DELETE endpoint permanently removes patient records without soft-delete or integrity verification. An attacker or malicious insider can destroy evidence of their activities or cause data loss.

**Impact**:
- Permanent PHI loss
- Inability to recover from attacks
- Audit trail destruction
- Regulatory compliance issues

**Likelihood**: LOW (requires authenticated access)

**Risk Score**: MEDIUM (warning level)

---

## Aggregate Risk Assessment

**Overall Risk Level**: CRITICAL

**Primary Concerns**:
1. Unencrypted PHI storage creates single point of failure
2. Missing audit logs prevent breach detection
3. Single-factor auth lowers barrier to unauthorized access
4. Plain HTTP transmission exposes data in transit

**Recommended Mitigations**:
1. Implement field-level encryption for all PHI
2. Add comprehensive audit logging to all PHI operations
3. Require MFA for all authenticated endpoints
4. Enforce TLS 1.2+ for all PHI transmission
5. Implement soft-delete with integrity verification

---

## Threat Model Changes Summary

| Threat Category | Before PR | After PR | Delta |
|-----------------|-----------|----------|-------|
| Data at Rest | No PHI stored | Unencrypted PHI | +CRITICAL |
| Data in Transit | No PHI transmitted | Plain HTTP PHI | +HIGH |
| Authentication | No auth system | Single-factor JWT | +HIGH |
| Audit/Logging | No PHI access | No audit trail | +HIGH |
| Data Integrity | No PHI deletion | Hard delete | +MEDIUM |

**Net Change**: Introduction of 4 HIGH/CRITICAL and 1 MEDIUM threat vectors without corresponding controls.