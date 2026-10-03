// FileStorage.h  -  Unit 5: File Handling (fstream, sequential I/O, error handling)
#pragma once
#include "Storage.h"

class FileStorage : public Storage {          // inheritance: FileStorage IS-A Storage
    std::string dir;
    std::string path(const std::string& file) const { return dir + "/" + file; }
public:
    explicit FileStorage(const std::string& dataDir);
    ~FileStorage() {}

    void loadInventory(std::vector<Medicine>& out) override;
    void saveInventory(const std::vector<Medicine>& meds) override;
    void appendUsage(const UsageRecord& r) override;
    std::vector<UsageRecord> readUsage() override;
    void appendAlertLog(const std::string& line) override;
    void loadBills(std::vector<Bill>& out) override;
    void appendBill(const Bill& b) override;
};
