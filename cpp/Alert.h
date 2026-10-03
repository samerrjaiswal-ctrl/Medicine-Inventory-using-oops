// Alert.h  -  Unit 4: abstract class, inheritance, virtual functions, run-time polymorphism
#pragma once
#include <string>

class Alert {
protected:
    std::string medicine, batch;
    static int created;                        // static member: how many alerts were created
public:
    Alert(const std::string& medicine, const std::string& batch);
    virtual ~Alert();

    virtual std::string type() const = 0;      // pure virtual => Alert is an abstract class
    virtual std::string level() const = 0;
    virtual std::string message() const = 0;
    virtual int severity() const = 0;          // used to sort (higher = more urgent)

    std::string toJson() const;
    std::string toLogLine(const std::string& date) const;
    static int totalCreated() { return created; }
};

class ExpiryAlert : public Alert {
    long daysLeft;
    int qty;
public:
    ExpiryAlert(const std::string& medicine, const std::string& batch, long daysLeft, int qty);
    static std::string levelFor(long daysLeft);        // Expired / Critical / Warning / Watch / Safe
    std::string type() const override { return "Expiry"; }
    std::string level() const override { return levelFor(daysLeft); }
    std::string message() const override;
    int severity() const override;
};

class LowStockAlert : public Alert {
    int qty, threshold;
public:
    LowStockAlert(const std::string& medicine, int qty, int threshold);
    std::string type() const override { return "LowStock"; }
    std::string level() const override { return "Low Stock"; }
    std::string message() const override;
    int severity() const override { return 3; }
};
