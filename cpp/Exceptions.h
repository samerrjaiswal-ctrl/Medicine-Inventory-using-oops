// Exceptions.h  -  Unit 6: Exception Handling (custom exception hierarchy)
#pragma once
#include <stdexcept>
#include <string>

class InventoryException : public std::runtime_error {
public:
    explicit InventoryException(const std::string& msg) : std::runtime_error(msg) {}
};
class ValidationException : public InventoryException {
public:
    explicit ValidationException(const std::string& m) : InventoryException(m) {}
};
class NotFoundException : public InventoryException {
public:
    explicit NotFoundException(const std::string& m) : InventoryException(m) {}
};
class InsufficientStockException : public InventoryException {
public:
    explicit InsufficientStockException(const std::string& m) : InventoryException(m) {}
};
class StorageException : public InventoryException {
public:
    explicit StorageException(const std::string& m) : InventoryException(m) {}
};
