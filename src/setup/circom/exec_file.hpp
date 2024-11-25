#ifndef EXEC_FILE
#define EXEC_FILE

#define EXEC_FILE_SIZE
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <sys/stat.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>


void loadFileParallel(void* buffer, const std::string &fileName, uint64_t size) {

    // Check file size
    struct stat sb;
    if (lstat(fileName.c_str(), &sb) == -1) {
        exit(-1);
    }
    if ((uint64_t)sb.st_size != size) {
        exit(-1);
    }

    // Determine the number of chunks and the size of each chunk
    size_t numChunks = 8; //omp_get_max_threads()/2;
    if(numChunks == 0 ) numChunks = 1;
    size_t chunkSize = size / numChunks;
    size_t remainder = size - numChunks*chunkSize;
    
    #pragma omp parallel for num_threads(numChunks)
    for(size_t i=0; i<numChunks; i++){
        // Open the file
        FILE* file = fopen(fileName.c_str(), "rb");
        if(file == NULL){
            exit(-1);
        }
        size_t chunkSize_ = i == numChunks -1 ? chunkSize + remainder : chunkSize;
        size_t offset = i * chunkSize;
        fseek(file, offset, SEEK_SET);
        size_t readed = fread((uint8_t*)buffer + offset, 1, chunkSize_, file);
        if(readed != chunkSize_){
            exit(-1);
        }
        fclose(file);
    }
}

class ExecFile
{
public:
    uint64_t nAdds;
    uint64_t nSMap;

    uint64_t *p_data;
    uint64_t *p_adds;
    uint64_t *p_sMap;

    ExecFile(const std::string &execFile, uint64_t nCommitedPols)
    {
        std::ifstream file(execFile, std::ios::binary);
        file.read(reinterpret_cast<char *>(&nAdds), sizeof(uint64_t));
        file.read(reinterpret_cast<char *>(&nSMap), sizeof(uint64_t));
        
        p_data = new uint64_t[2 + nAdds * 4 + nSMap * nCommitedPols];
        
        loadFileParallel(p_data, execFile, (2 + nAdds * 4 + nSMap * nCommitedPols) * sizeof(uint64_t));
        
        p_adds = &p_data[2];
        p_sMap = &p_data[2 + nAdds * 4];
    }

    ~ExecFile()
    {
        delete[] p_data;
    }
};
#endif
