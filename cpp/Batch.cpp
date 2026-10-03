#include "Batch.h"
#include "Exceptions.h"

Batch::Batch() : batchNo(""), quantity(0), expiry(Date(2100, 1, 1)) {}

Batch::Batch(const std::string& no, int qty, const Date& exp) : batchNo(no), quantity(qty), expiry(exp) {
    if (no.empty() || no.find(',') != std::string::npos || no.find('|') != std::string::npos)
        throw ValidationException("Batch number is invalid (empty or contains , or |)");
    if (qty < 0) throw ValidationException("Quantity cannot be negative");
}

Batch& Batch::setQuantity(int q) {
    if (q < 0) throw ValidationException("Quantity cannot be negative");
    this->quantity = q;
    return *this;
}

Batch& Batch::setExpiry(const Date& e) {
    this->expiry = e;
    return *this;
}
