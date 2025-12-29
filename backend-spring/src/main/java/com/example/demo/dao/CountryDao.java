package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import com.example.demo.dto.Country;

@Mapper
public interface CountryDao {

	@Select("""
			select *
				from country 
				order by id asc
			""")
	List<Country> findAll();
}
