package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Reaction {
    private Integer id;
    private String relTypeCode;
    private Integer relId;
    private Integer memberId;
    private String regDate;
}
