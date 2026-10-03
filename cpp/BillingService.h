// BillingService.h  -  creates bills; reduces stock using FEFO; stores history
#pragma once
#include <string>
#include <vector>
#include <utility>
#include "InventoryManager.h"
#include "Bill.h"

class BillingService {
    InventoryManager& inventory;
    Storage& storage;
    std::vector<Bill> history;                 // bill history loaded from bills.dat
public:
    BillingService(InventoryManager& inv, Storage& st);
    void load();                               // reads bills.dat and sets Bill counter

    // request = list of (medicine name/id, quantity)
    Bill createBill(const std::string& buyer, const std::vector<std::pair<std::string, int>>& request, const Date& today);

    const std::vector<Bill>& getHistory() const { return history; }
    const Bill& getBill(const std::string& id) const;     // throws NotFoundException
    std::string historyJson() const;
};
