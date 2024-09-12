WITNESS_DIR ?= ./tmp
WITNESS_FILE ?= witness.so

BUILD_DIR := build

CXX := g++
CXXFLAGS := -std=c++17 -Wall -pthread -flarge-source-files -Wno-unused-label -rdynamic -mavx2 -O3 #-Wfatal-errors
CXXFLAGS_EXT := -fPIC
CFLAGS := -fopenmp -Wno-unused-variable

CPPFLAGS := -I ./setup/circom

AS := nasm
ASFLAGS := -felf64


clean:
	$(RM) -r $(BUILD_DIR)

witness: $(WITNESS_DIR)/$(WITNESS_FILE)

SRCS_WITNESS_LIB := ./src/setup/circom/calcwit.cpp ./src/setup/circom/fr.cpp ./src/setup/circom/fr.asm 
SRCS_WITNESS_LIB += ./src/setup/circom/timer.cpp ./src/setup/circom/zklog.cpp
SRCS_WITNESS_LIB += ./src/setup/circom/gl/src/goldilocks_base_field.cpp
SRCS_WITNESS_LIB += ./src/setup/circom/main.cpp ./src/setup/circom/verifier.cpp
OBJS_WITNESS_LIB := $(SRCS_WITNESS_LIB:%=$(BUILD_DIR)/%.o)
DEPS_WITNESS_LIB := $(OBJS_WITNESS_LIB:.o=.d)

$(WITNESS_DIR)/$(WITNESS_FILE): $(OBJS_WITNESS_LIB)
	$(MKDIR_P) $(WITNESS_DIR)
	$(CXX) -shared -o $@ $^

# assembly
$(BUILD_DIR)/%.asm.o: %.asm
	$(MKDIR_P) $(dir $@)
	$(AS) $(ASFLAGS) $< -o $@

# c++ source
$(BUILD_DIR)/%.cpp.o: %.cpp
	$(MKDIR_P) $(dir $@)
	$(CXX) $(CFLAGS) $(CPPFLAGS) $(CXXFLAGS) $(CXXFLAGS_EXT) -c $< -o $@

MKDIR_P ?= mkdir -p

.PHONY: clean