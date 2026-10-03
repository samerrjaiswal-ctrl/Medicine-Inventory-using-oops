// Batch.h  -  Unit 2/3: class with constructors (overloaded), getters/setters, operator<
#pragma once
#include <string>
#include "Date.h"

class Batch {
    std::string batchNo;
    int quantity;
    Date expiry;
public:
    Batch();                                              // default constructor
    Batch(const std::string& no, int qty, const Date& exp); // parameterised constructor
    ~Batch() {}

    const std::string& getBatchNo() const { return batchNo; }
    int getQuantity() const { return quantity; }
    const Date& getExpiry() const { return expiry; }

    Batch& setQuantity(int q);          // returns *this (this pointer)
    Batch& setExpiry(const Date& e);

    bool isExpired(const Date& today) const { return expiry < today; }
    long daysLeft(const Date& today) const { return expiry - today; }

    // FEFO: batch that expires first is "smaller"
    bool operator<(const Batch& other) const { return expiry < other.expiry; }
};
