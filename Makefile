CXX      = g++
CXXFLAGS = -std=c++17 -O2 -Wall -pthread
SRC      = $(wildcard cpp/*.cpp)

server: $(SRC) $(wildcard cpp/*.h)
	$(CXX) $(CXXFLAGS) -o server $(SRC)

clean:
	rm -f server server.exe
