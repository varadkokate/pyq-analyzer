const SAMPLE_PAPER_2022 = `STATE TECHNICAL UNIVERSITY
B.Tech. Semester IV Examination — May 2022
Subject: Operating Systems (CS-402)
Duration: 3 Hours | Maximum Marks: 70

SECTION A (Short Answer — 2 Marks each)
Q1. Define a process control block (PCB) and list any four fields stored in it. (2 Marks)
Q2. Differentiate between paging and segmentation in memory management. (2 Marks)
Q3. What is Belady's anomaly? Name one page replacement algorithm that suffers from it. (2 Marks)
Q4. State the difference between preemptive and non-preemptive CPU scheduling. (2 Marks)
Q5. What is thrashing in virtual memory? (2 Marks)

SECTION B (Medium Answer — 6 Marks each)
Q6. Explain the four necessary conditions for a deadlock to occur with suitable examples. (6 Marks)
Q7. Compare Shortest Job First (SJF) and Round Robin (RR) CPU scheduling algorithms with respect to turnaround time, waiting time, and starvation. (6 Marks)
Q8. Explain the Producer-Consumer problem and provide a semaphore-based synchronization solution. (6 Marks)
Q9. Explain demand paging and calculate the effective access time when page fault rate is p. (6 Marks)
Q10. Compare contiguous, linked, and indexed file allocation methods. (6 Marks)

SECTION C (Long Answer — 10 Marks each)
Q11. Explain Banker's Algorithm for deadlock avoidance. Given an Allocation matrix, Max matrix, and Available vector, trace the safety algorithm to determine whether the system is in a safe state. (10 Marks)
Q12. Consider the page reference string: 7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2 with 3 frames. Calculate the number of page faults using FIFO, LRU, and Optimal page replacement algorithms. (10 Marks)
Q13. Compare FCFS, SSTF, SCAN, and C-SCAN disk scheduling algorithms using a numerical head movement example starting at cylinder 53. (10 Marks)
`;

const SAMPLE_PAPER_2023 = `STATE TECHNICAL UNIVERSITY
B.Tech. Semester IV Examination — December 2023
Subject: Operating Systems (CS-402)
Duration: 3 Hours | Maximum Marks: 70

SECTION A (Short Answer — 2 Marks each)
Q1. What are the five states of a process lifecycle? Draw a neat state transition diagram. (2 Marks)
Q2. Distinguish between internal fragmentation and external fragmentation. (2 Marks)
Q3. Define a critical section and list the three requirements of a valid critical section solution. (2 Marks)
Q4. What is a Translation Lookaside Buffer (TLB) and how does it improve paging performance? (2 Marks)
Q5. Define thrashing and state one technique to control it using the working set model. (2 Marks)

SECTION B (Medium Answer — 6 Marks each)
Q6. List and explain Coffman's four necessary conditions for deadlock. How can circular wait be prevented? (6 Marks)
Q7. Solve the Dining Philosophers problem using semaphores or monitors and explain how deadlock is avoided. (6 Marks)
Q8. Differentiate between paging and segmentation. How does segmented paging combine both approaches? (6 Marks)
Q9. Explain Multilevel Feedback Queue scheduling and compare it with Round Robin scheduling. (6 Marks)
Q10. Explain indexed file allocation and inode structure used in UNIX file systems. (6 Marks)

SECTION C (Long Answer — 10 Marks each)
Q11. Describe Banker's algorithm for deadlock avoidance in detail. Explain both the Safety Algorithm and the Resource-Request Algorithm with a worked numerical example. (10 Marks)
Q12. For the reference string 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5 with 3 and 4 frames, compute page faults for FIFO and LRU algorithms and demonstrate Belady's anomaly. (10 Marks)
Q13. Given disk requests at tracks 82, 170, 43, 140, 24, 16, 190 with initial head at 50, calculate total seek distance for SSTF, SCAN, and LOOK disk scheduling algorithms. (10 Marks)
`;

const SAMPLE_PAPER_2024 = `STATE TECHNICAL UNIVERSITY
B.Tech. Semester IV Examination — May 2024
Subject: Operating Systems (CS-402)
Duration: 3 Hours | Maximum Marks: 70

SECTION A (Short Answer — 2 Marks each)
Q1. Explain the role of Process Control Block (PCB) during context switching. (2 Marks)
Q2. What is the difference between a user-level thread and a kernel-level thread? (2 Marks)
Q3. Define virtual memory and explain the role of the page table and TLB. (2 Marks)
Q4. What is a race condition? Give a brief example. (2 Marks)
Q5. State the difference between internal and external fragmentation. (2 Marks)

SECTION B (Medium Answer — 6 Marks each)
Q6. State and illustrate the four necessary conditions that cause a deadlock in an operating system. (6 Marks)
Q7. Write a semaphore-based solution to the Bounded Buffer (Producer-Consumer) synchronization problem and explain why the order of wait operations matters. (6 Marks)
Q8. Given five processes with arrival times and burst times, compute average waiting time and turnaround time for SJF (Preemptive) and Round Robin (Quantum = 2 ms). (6 Marks)
Q9. Explain demand paging, page fault handling steps, and thrashing prevention via working sets. (6 Marks)
Q10. Compare contiguous, linked, and indexed file allocation strategies with advantages and limitations. (6 Marks)

SECTION C (Long Answer — 10 Marks each)
Q11. Apply Banker's Algorithm to check system safety and evaluate whether a new resource request from Process P1 can be granted immediately without entering an unsafe state. (10 Marks)
Q12. Compare FIFO, Optimal, and Least Recently Used (LRU) page replacement algorithms on a given page reference sequence and explain why Optimal is used as a benchmark. (10 Marks)
Q13. Explain disk scheduling algorithms (FCFS, SSTF, SCAN, C-SCAN) and compute total head movement for a sample cylinder request queue. (10 Marks)
`;

export function createSamplePaperFiles(): {
  files: File[];
  subjectName: string;
  examTag: string;
} {
  const files = [
    new File([SAMPLE_PAPER_2022], 'OS_May_2022.txt', { type: 'text/plain' }),
    new File([SAMPLE_PAPER_2023], 'OS_Dec_2023.txt', { type: 'text/plain' }),
    new File([SAMPLE_PAPER_2024], 'OS_May_2024.txt', { type: 'text/plain' }),
  ];

  return {
    files,
    subjectName: 'Operating Systems (CS-402)',
    examTag: 'B.Tech Semester IV · State Technical University',
  };
}
