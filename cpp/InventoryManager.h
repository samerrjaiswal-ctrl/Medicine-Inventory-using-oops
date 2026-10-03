// InventoryManager.h  -  owns all Medicine objects. Single Responsibility: stock operations only.
#pragma once
#include <string>
#include <vector>
#include "Medicine.h"
#include "Storage.h"

class InventoryManager {
    std::vector<Medicine> medicines;      // array of objects
    Storage& storage;                     // depends on abstraction (Dependency Inversion)
    std::string nextId() const;
public:
    explicit InventoryManager(Storage& s);
    ~InventoryManager() {}

    void load();
    void save();

    const std::vector<Medicine>& getAll() const { return medicines; }
    Medicine* find(const std::string& idOrName);                 // throws nothing, returns nullptr
    Medicine& get(const std::string& idOrName);                  // throws NotFoundException

    std::string addMedicine(const std::string& name, char category, double price, int minLevel,
                            const std::string& batchNo, int qty, const Date& expiry);
    void updateQuantity(const std::string& medicine, const std::string& batchNo, int qty);
    void updateExpiry(const std::string& medicine, const std::string& batchNo, const Date& expiry);
    int removeExpired(const Date& today);                        // returns batches removed

    std::vector<Medicine> snapshot() const { return medicines; } // used by billing for rollback
    void restore(const std::vector<Medicine>& s) { medicines = s; }
};
