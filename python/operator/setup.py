from setuptools import setup

setup(name='dablchat-operator-bot',
      version='1.8.0',
      description='DABL Chat Operator',
      author='Digital Asset',
      license='Apache2',
      install_requires=['dazl'],
      packages=['bot'],
      include_package_data=True)
