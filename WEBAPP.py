import streamlit as st
import json
import os
import datetime
import urllib.parse
bb_file = "pragatipath_data.json"
def load_data():
    if not os.path.exists(bb_file):
        return {"batches": {}}
    with open(bb_file, "r") as f:
        return json.load(f)
    def save_data(data):
        with open(bb_file, "w")as f:
            json.dump(data, f)
data = load_data()
pages = ["🏠 Home", "➕Add Group", "Add Member", "Settings"]
page = st.sidebar.radio("Navigate",pages)
if page=="🏠 Home":
    st.title["Pragati Path"]
    st.markdown("Manage Pragati Path")
elif page== "➕Add Group":
    st.title["Add new group"]
    new_group= st.text_input["Enter Group Name"]
    if st.button["create group"]:
        if new_group in data ["batches"]:
            st.warning["Group already exist"]
        else:
            data["batches"] [new_group]=  {"Name":{}, "Phone Number":{}, "Email Address":{}}
            st(load_data)
        st.success[f"Group'{new_group}' created"]
