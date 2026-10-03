// Medicine.h  -  Unit 2: class, objects, friend function, 'this', vector of objects (composition: Medicine HAS Batches)
#pragma once
#include <string>
#include <vector>
#include <utility>
#include <ostream>
#include "Batch.h"

class Medicine {
    std::string id, name;
    char category;                 // VED analysis: V = Vital, E = Essential, D = Desirable
    double price;                  // per unit (Rs)
    int minLevel;                  // minimum stock set by pharmacist
    std::vector<Batch> batches;
public:
    Medicine();
    Medicine(const std::string& id, const std::string& name, char category, double price, int minLevel);
    ~Medicine() {}

    const std::string& getId() const { return id; }
    const std::string& getName() const { return name; }
    char getCategory() const { return category; }
    double getPrice() const { return price; }
    int getMinLevel() const { return minLevel; }
    const std::vector<Batch>& getBatches() const { return batches; }

    Medicine& setPrice(double p);
    Medicine& setMinLevel(int m);

    void addBatch(const Batch& b);                 // merges quantity if batch no. already exists
    Batch* findBatch(const std::string& batchNo);
    void sortFEFO();                               // earliest expiry first
    int totalQty() const;
    int validQty(const Date& today) const;         // quantity in non-expired batches
    int removeExpiredBatches(const Date& today);   // returns number of batches removed

    // FEFO consumption: returns list of (batchNo, qtyTaken)
    std::vector<std::pair<std::string, int>> consumeFEFO(int qty, const Date& today);

    friend std::ostream& operator<<(std::ostream& os, const Medicine& m);   // friend function
};
