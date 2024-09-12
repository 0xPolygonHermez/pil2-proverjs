WITNESS_DIR ?= $(error WITNESS_DIR is not set)
WITNESS_FILE ?= $(error WITNESS_FILE is not set)

BUILD_DIR := ../../../build

CXX := g++
CXXFLAGS := -std=c++17 -Wall -pthread -flarge-source-files -Wno-unused-label -rdynamic -mavx2 -O3 #-Wfatal-errors
CXXFLAGS_EXT := -fPIC
CFLAGS := -fopenmp

CPPFLAGS := -I ../goldilocks/src -I ./utils -I .

witness: $(WITNESS_DIR)/$(WITNESS_FILE)

SRCS_WITNESS_LIB := $(shell find ./ -name '*.cpp')
OBJS_WITNESS_LIB := $(SRCS_WITNESS_LIB:%=$(BUILD_DIR)/%.o)
DEPS_WITNESS_LIB := $(OBJS_WITNESS_LIB:.o=.d)

$(WITNESS_DIR)/$(WITNESS_FILE): $(OBJS_WITNESS_LIB)
	$(MKDIR_P) $(WITNESS_DIR)
	$(CXX) -shared -o $@ $^

# c++ source
$(BUILD_DIR)/%.cpp.o: %.cpp
	$(MKDIR_P) $(dir $@)
	$(CXX) $(CFLAGS) $(CPPFLAGS) $(CXXFLAGS) $(CXXFLAGS_EXT) -c $< -o $@

MKDIR_P ?= mkdir -p

clean:
	$(RM) -r $(BUILD_DIR)