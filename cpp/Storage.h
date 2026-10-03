// Storage.h  -  abstract base class (interface). Business classes depend on THIS, not on files (SOLID: D, I)
#pragma once
#include <string>
#include <vector>
#include "Medicine.h"
#include "Bill.h"

struct UsageRecord {
    Date date;
    std::string medicineId;
    int quantity;
};

class Storage {
public:
    virtual ~Storage() {}                                                  // virtual destructor
    virtual void loadInventory(std::vector<Medicine>& out) = 0;            // pure virtual functions
    virtual void saveInventory(const std::vector<Medicine>& meds) = 0;
    virtual void appendUsage(const UsageRecord& r) = 0;
    virtual std::vector<UsageRecord> readUsage() = 0;
    virtual void appendAlertLog(const std::string& line) = 0;
    virtual void loadBills(std::vector<Bill>& out) = 0;
    virtual void appendBill(const Bill& b) = 0;
};
